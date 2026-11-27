import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import pool from "../src/db/database.js";
import app from "../src/app.js";
import {
    createFixtures,
    removeFixtures,
    type Fixtures
} from "./helpers/fixtures.js";

let fixtures: Fixtures;

// Every product made by this file starts with this text
const marker = `desc${randomUUID().slice(0, 8)}`;

beforeAll(async () => {
    fixtures = await createFixtures("products-description");
});

afterAll(async () => {
    await pool.query("DELETE FROM products WHERE name LIKE $1", [`${marker}%`]);
    await removeFixtures(fixtures);
});

const authorization = () => `Bearer ${fixtures.token}`;

const product = (changes: Record<string, unknown> = {}) => ({
    name: `${marker} product`,
    price: 10,
    stock_quantity: 4,
    ...changes
});

describe("Product description", () => {
    it("stores, changes and clears the description", async () => {
        const created = await request(app)
            .post("/api/products")
            .set("Authorization", authorization())
            .send(product({ description: "  A fast laptop  " }));

        expect(created.status).toBe(201);
        expect(created.body.data.description).toBe("A fast laptop");

        const id: number = created.body.data.id;

        const read = await request(app)
            .get(`/api/products/${id}`)
            .set("Authorization", authorization());

        expect(read.body.data.description).toBe("A fast laptop");

        const put = (body: Record<string, unknown>) =>
            request(app)
                .put(`/api/products/${id}`)
                .set("Authorization", authorization())
                .send(body);

        const changed = await put(product({ description: "Now with 16 GB" }));

        expect(changed.status).toBe(200);
        expect(changed.body.data.description).toBe("Now with 16 GB");

        // A blank text, null, or no description at all clears it
        for (const clearing of [{ description: "   " }, { description: null }, {}]) {
            const set = await put(product({ description: "Something" }));

            expect(set.body.data.description).toBe("Something");

            const cleared = await put(product(clearing));

            expect(cleared.status).toBe(200);
            expect(cleared.body.data.description).toBeNull();
        }
    });

    it("rejects a description that is too long or not text", async () => {
        const longest = await request(app)
            .post("/api/products")
            .set("Authorization", authorization())
            .send(product({ description: "d".repeat(1000) }));

        expect(longest.status).toBe(201);

        const tooLong = await request(app)
            .post("/api/products")
            .set("Authorization", authorization())
            .send(product({ description: "d".repeat(1001) }));

        expect(tooLong.status).toBe(400);
        expect(tooLong.body).toEqual({
            success: false,
            message: "Description must be 1000 characters or fewer"
        });

        for (const description of [5, true, ["text"], { text: "x" }]) {
            const response = await request(app)
                .post("/api/products")
                .set("Authorization", authorization())
                .send(product({ description }));

            expect(response.status).toBe(400);
            expect(response.body).toEqual({
                success: false,
                message: "Invalid product data"
            });
        }
    });
});
