import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import pool from "../src/db/database.js";
import app from "../src/app.js";
import {
    createFixtures,
    removeFixtures,
    type Fixtures
} from "./helpers/fixtures.js";

let fixtures: Fixtures;

// Every customer made by this file starts with this text
const marker = `cust${randomUUID().slice(0, 8)}`;

// Part of a phone number that no other row has
const phoneTag = String(Date.now()).slice(-9);

beforeAll(async () => {
    fixtures = await createFixtures("customers-crud");
});

afterAll(async () => {
    await pool.query("DELETE FROM customers WHERE name LIKE $1", [`${marker}%`]);
    await removeFixtures(fixtures);
});

const authorization = () => `Bearer ${fixtures.token}`;

type CustomerRow = { name: string };

describe("Listing customers", () => {
    beforeAll(async () => {
        // Created one after another, so Gamma gets the highest id
        const rows = [
            ["Alpha", null, `alpha.${marker}@example.com`],
            ["Beta", `0${phoneTag}`, `beta.${marker}@example.com`],
            ["Gamma", null, null]
        ] as const;

        for (const [name, phone, email] of rows) {
            await pool.query(
                `INSERT INTO customers (name, phone, email)
                 VALUES ($1, $2, $3)`,
                [`${marker} ${name}`, phone, email]
            );
        }
    });

    const list = async (query: string) => {
        const response = await request(app)
            .get(`/api/customers?${query}`)
            .set("Authorization", authorization());

        expect(response.status).toBe(200);

        return response.body.data as {
            customers: CustomerRow[];
            pagination: Record<string, number>;
        };
    };

    const namesOf = (data: { customers: CustomerRow[] }) =>
        data.customers.map((customer) => customer.name.slice(marker.length + 1));

    it("finds customers by name, email or phone, newest first", async () => {
        expect(namesOf(await list(`search=${marker}`))).toEqual([
            "Gamma",
            "Beta",
            "Alpha"
        ]);

        expect(namesOf(await list(`search=${marker.toUpperCase()}`))).toEqual([
            "Gamma",
            "Beta",
            "Alpha"
        ]);

        // Only Beta has this email
        expect(namesOf(await list(`search=beta.${marker}`))).toEqual(["Beta"]);

        // Only Beta has this phone
        expect(namesOf(await list(`search=${phoneTag}`))).toEqual(["Beta"]);
    });

    it("paginates results", async () => {
        const page1 = await list(`search=${marker}&limit=2&page=1`);

        expect(namesOf(page1)).toEqual(["Gamma", "Beta"]);
        expect(page1.pagination).toEqual({
            page: 1,
            limit: 2,
            total: 3,
            totalPages: 2,
            count: 2
        });

        const page2 = await list(`search=${marker}&limit=2&page=2`);

        expect(namesOf(page2)).toEqual(["Alpha"]);
        expect(page2.pagination).toEqual({
            page: 2,
            limit: 2,
            total: 3,
            totalPages: 2,
            count: 1
        });
    });

    it("returns an empty list when nothing matches", async () => {
        const data = await list(`search=${marker}nomatch`);

        expect(data.customers).toEqual([]);
        expect(data.pagination).toEqual({
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 0,
            count: 0
        });
    });
});

describe("Creating, changing and deleting customers", () => {
    it("creates, reads, updates and deletes a customer", async () => {
        const created = await request(app)
            .post("/api/customers")
            .set("Authorization", authorization())
            .send({
                name: `${marker} Flow`,
                phone: "0911223344",
                email: `flow.${marker}@example.com`
            });

        expect(created.status).toBe(201);
        expect(created.body).toEqual({
            success: true,
            data: {
                id: expect.any(Number),
                name: `${marker} Flow`,
                phone: "0911223344",
                email: `flow.${marker}@example.com`,
                created_at: expect.any(String)
            }
        });

        const id: number = created.body.data.id;

        const read = await request(app)
            .get(`/api/customers/${id}`)
            .set("Authorization", authorization());

        expect(read.status).toBe(200);
        expect(read.body).toEqual(created.body);

        // The phone is left out, so the update clears it
        const updated = await request(app)
            .put(`/api/customers/${id}`)
            .set("Authorization", authorization())
            .send({
                name: `${marker} Flow Updated`,
                email: `flow.updated.${marker}@example.com`
            });

        expect(updated.status).toBe(200);
        expect(updated.body).toEqual({
            success: true,
            data: {
                id,
                name: `${marker} Flow Updated`,
                phone: null,
                email: `flow.updated.${marker}@example.com`,
                created_at: created.body.data.created_at
            }
        });

        const deleted = await request(app)
            .delete(`/api/customers/${id}`)
            .set("Authorization", authorization());

        expect(deleted.status).toBe(200);
        expect(deleted.body).toEqual({
            success: true,
            data: {
                message: "Customer deleted successfully",
                customer: updated.body.data
            }
        });

        const gone = await request(app)
            .get(`/api/customers/${id}`)
            .set("Authorization", authorization());

        expect(gone.status).toBe(404);
        expect(gone.body).toEqual({
            success: false,
            message: "Customer not found"
        });

        const deletedAgain = await request(app)
            .delete(`/api/customers/${id}`)
            .set("Authorization", authorization());

        expect(deletedAgain.status).toBe(404);
    });

    it("cleans the input and stores optional fields as null", async () => {
        const full = await request(app)
            .post("/api/customers")
            .set("Authorization", authorization())
            .send({
                name: `  ${marker} Full  `,
                phone: "  0912345678  ",
                email: `  Full.${marker}@EXAMPLE.com  `
            });

        expect(full.status).toBe(201);
        expect(full.body.data).toMatchObject({
            name: `${marker} Full`,
            phone: "0912345678",
            email: `full.${marker}@example.com`
        });

        const nameOnly = await request(app)
            .post("/api/customers")
            .set("Authorization", authorization())
            .send({ name: `${marker} Only` });

        expect(nameOnly.status).toBe(201);
        expect(nameOnly.body.data).toMatchObject({
            name: `${marker} Only`,
            phone: null,
            email: null
        });
    });

    it("rejects invalid customer input on create and update", async () => {
        const cases: [unknown, string][] = [
            [{}, "Invalid customer data"],
            [{ name: "   " }, "Invalid customer data"],
            [{ name: "x", phone: "   " }, "Invalid customer data"],
            [{ name: "x", email: "   " }, "Invalid customer data"],
            [{ name: "x", email: "not-an-email" }, "Invalid email address"],
            [{ name: "x", email: "a@b" }, "Invalid email address"]
        ];

        for (const [body, message] of cases) {
            const create = await request(app)
                .post("/api/customers")
                .set("Authorization", authorization())
                .send(body as object);

            expect(create.status).toBe(400);
            expect(create.body).toEqual({ success: false, message });

            const update = await request(app)
                .put(`/api/customers/${fixtures.customerId}`)
                .set("Authorization", authorization())
                .send(body as object);

            expect(update.status).toBe(400);
            expect(update.body).toEqual({ success: false, message });
        }
    });

    it("answers 404 for ids that do not exist", async () => {
        const missing = "/api/customers/2147483647";

        const read = await request(app)
            .get(missing)
            .set("Authorization", authorization());
        const update = await request(app)
            .put(missing)
            .set("Authorization", authorization())
            .send({ name: `${marker} Ghost` });
        const remove = await request(app)
            .delete(missing)
            .set("Authorization", authorization());

        for (const response of [read, update, remove]) {
            expect(response.status).toBe(404);
            expect(response.body).toEqual({
                success: false,
                message: "Customer not found"
            });
        }
    });
});

describe("Unexpected errors in the customers API", () => {
    it("answers 500 without details when the database fails", async () => {
        const spy = vi
            .spyOn(pool, "query")
            .mockRejectedValueOnce(new Error("secret database detail"));

        try {
            const response = await request(app)
                .get("/api/customers/1")
                .set("Authorization", authorization());

            expect(spy).toHaveBeenCalledTimes(1);
            expect(response.status).toBe(500);
            expect(response.body).toEqual({
                success: false,
                message: "Failed to get customer"
            });
            expect(JSON.stringify(response.body)).not.toContain(
                "secret database detail"
            );
        } finally {
            spy.mockRestore();
        }
    });
});
