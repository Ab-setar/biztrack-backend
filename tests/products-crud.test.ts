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

// Every product made by this file starts with this text,
// so the searches are exact and the cleanup is exact
const marker = `crud${randomUUID().slice(0, 8)}`;

beforeAll(async () => {
    fixtures = await createFixtures("products-crud");
});

afterAll(async () => {
    await pool.query("DELETE FROM products WHERE name LIKE $1", [`${marker}%`]);
    await removeFixtures(fixtures);
});

const authorization = () => `Bearer ${fixtures.token}`;

type ProductRow = { name: string; price: string; stock_quantity: number };

describe("Listing products", () => {
    beforeAll(async () => {
        // Created one after another, so Gamma gets the highest id
        const rows = [
            ["Alpha", 10, 0],
            ["Beta", 50, 5],
            ["Gamma", 200, 20]
        ] as const;

        for (const [name, price, stock] of rows) {
            await pool.query(
                `INSERT INTO products (name, price, stock_quantity)
                 VALUES ($1, $2, $3)`,
                [`${marker} ${name}`, price, stock]
            );
        }
    });

    const list = async (query = "") => {
        const response = await request(app)
            .get(`/api/products?search=${marker}${query}`)
            .set("Authorization", authorization());

        expect(response.status).toBe(200);

        return response.body.data as {
            products: ProductRow[];
            pagination: Record<string, number>;
        };
    };

    const namesOf = (data: { products: ProductRow[] }) =>
        data.products.map((product) => product.name.slice(marker.length + 1));

    it("finds products by name, newest first, ignoring case", async () => {
        expect(namesOf(await list())).toEqual(["Gamma", "Beta", "Alpha"]);

        const upper = await request(app)
            .get(`/api/products?search=${marker.toUpperCase()}`)
            .set("Authorization", authorization());

        expect(namesOf(upper.body.data)).toEqual(["Gamma", "Beta", "Alpha"]);

        const first = (await list()).products[2];

        expect(first.price).toBe("10.00");
        expect(first.stock_quantity).toBe(0);
    });

    it("filters by price", async () => {
        expect(namesOf(await list("&minPrice=50"))).toEqual(["Gamma", "Beta"]);
        expect(namesOf(await list("&maxPrice=50"))).toEqual(["Beta", "Alpha"]);
        expect(namesOf(await list("&minPrice=20&maxPrice=100"))).toEqual(["Beta"]);
        expect(namesOf(await list("&minPrice=50&maxPrice=50"))).toEqual(["Beta"]);
    });

    it("filters by stock", async () => {
        expect(namesOf(await list("&inStock=true"))).toEqual(["Gamma", "Beta"]);
        expect(namesOf(await list("&inStock=false"))).toEqual(["Alpha"]);
        expect(namesOf(await list("&inStock=true&maxPrice=100"))).toEqual(["Beta"]);
    });

    it("paginates results", async () => {
        const page1 = await list("&limit=2&page=1");

        expect(namesOf(page1)).toEqual(["Gamma", "Beta"]);
        expect(page1.pagination).toEqual({
            page: 1,
            limit: 2,
            total: 3,
            totalPages: 2,
            count: 2
        });

        const page2 = await list("&limit=2&page=2");

        expect(namesOf(page2)).toEqual(["Alpha"]);
        expect(page2.pagination).toEqual({
            page: 2,
            limit: 2,
            total: 3,
            totalPages: 2,
            count: 1
        });
    });

    it("rejects invalid filters", async () => {
        const cases: [string, string][] = [
            ["minPrice=abc", "Invalid minimum price"],
            ["minPrice=-1", "Invalid minimum price"],
            ["maxPrice=abc", "Invalid maximum price"],
            ["maxPrice=-5", "Invalid maximum price"],
            [
                "minPrice=100&maxPrice=50",
                "Minimum price cannot be greater than maximum price"
            ],
            ["inStock=maybe", "Invalid inStock value. Use true or false"]
        ];

        for (const [query, message] of cases) {
            const response = await request(app)
                .get(`/api/products?${query}`)
                .set("Authorization", authorization());

            expect(response.status).toBe(400);
            expect(response.body).toEqual({ success: false, message });
        }
    });
});

describe("Creating, changing and deleting products", () => {
    it("creates, reads, updates and deletes a product", async () => {
        const created = await request(app)
            .post("/api/products")
            .set("Authorization", authorization())
            .send({
                name: `  ${marker} Created  `,
                price: 19.99,
                stock_quantity: 7
            });

        expect(created.status).toBe(201);
        expect(created.body).toEqual({
            success: true,
            data: {
                id: expect.any(Number),
                name: `${marker} Created`,
                price: "19.99",
                stock_quantity: 7,
                description: null,
                created_at: expect.any(String)
            }
        });

        const id: number = created.body.data.id;

        const read = await request(app)
            .get(`/api/products/${id}`)
            .set("Authorization", authorization());

        expect(read.status).toBe(200);
        expect(read.body).toEqual(created.body);

        const updated = await request(app)
            .put(`/api/products/${id}`)
            .set("Authorization", authorization())
            .send({ name: `${marker} Updated`, price: 25, stock_quantity: 3 });

        expect(updated.status).toBe(200);
        expect(updated.body).toEqual({
            success: true,
            data: {
                id,
                name: `${marker} Updated`,
                price: "25.00",
                stock_quantity: 3,
                description: null,
                created_at: created.body.data.created_at
            }
        });

        const deleted = await request(app)
            .delete(`/api/products/${id}`)
            .set("Authorization", authorization());

        expect(deleted.status).toBe(200);
        expect(deleted.body).toEqual({
            success: true,
            data: {
                message: "Product deleted successfully",
                product: updated.body.data
            }
        });

        const gone = await request(app)
            .get(`/api/products/${id}`)
            .set("Authorization", authorization());

        expect(gone.status).toBe(404);
        expect(gone.body).toEqual({ success: false, message: "Product not found" });

        const deletedAgain = await request(app)
            .delete(`/api/products/${id}`)
            .set("Authorization", authorization());

        expect(deletedAgain.status).toBe(404);
    });

    it("rejects invalid product input on create and update", async () => {
        const invalidBodies = [
            {},
            { name: "   ", price: 1, stock_quantity: 1 },
            { name: 5, price: 1, stock_quantity: 1 },
            { name: "x", price: "10", stock_quantity: 1 },
            { name: "x", price: null, stock_quantity: 1 },
            { name: "x", price: -0.01, stock_quantity: 1 },
            { name: "x", price: 1, stock_quantity: 1.5 },
            { name: "x", price: 1, stock_quantity: -1 }
        ];

        for (const body of invalidBodies) {
            const create = await request(app)
                .post("/api/products")
                .set("Authorization", authorization())
                .send(body);

            expect(create.status).toBe(400);
            expect(create.body).toEqual({
                success: false,
                message: "Invalid product data"
            });

            const update = await request(app)
                .put(`/api/products/${fixtures.productId}`)
                .set("Authorization", authorization())
                .send(body);

            expect(update.status).toBe(400);
            expect(update.body).toEqual({
                success: false,
                message: "Invalid product data"
            });
        }
    });

    it("answers 404 for ids that do not exist", async () => {
        const missing = "/api/products/2147483647";
        const body = { name: `${marker} Ghost`, price: 1, stock_quantity: 1 };

        const read = await request(app)
            .get(missing)
            .set("Authorization", authorization());
        const update = await request(app)
            .put(missing)
            .set("Authorization", authorization())
            .send(body);
        const remove = await request(app)
            .delete(missing)
            .set("Authorization", authorization());

        for (const response of [read, update, remove]) {
            expect(response.status).toBe(404);
            expect(response.body).toEqual({
                success: false,
                message: "Product not found"
            });
        }
    });
});

describe("Unexpected errors in the products API", () => {
    it("answers 500 without details when the database fails", async () => {
        const spy = vi
            .spyOn(pool, "query")
            .mockRejectedValueOnce(new Error("secret database detail"));

        try {
            const response = await request(app)
                .get("/api/products/1")
                .set("Authorization", authorization());

            expect(spy).toHaveBeenCalledTimes(1);
            expect(response.status).toBe(500);
            expect(response.body).toEqual({
                success: false,
                message: "Internal server error"
            });
            expect(JSON.stringify(response.body)).not.toContain(
                "secret database detail"
            );
        } finally {
            spy.mockRestore();
        }
    });
});
