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

// Everything these tests create starts with this text, so the cleanup is exact
const marker = `lim${randomUUID().slice(0, 8)}`;

beforeAll(async () => {
    fixtures = await createFixtures("input-limits");
});

afterAll(async () => {
    await pool.query("DELETE FROM products WHERE name LIKE $1", [`${marker}%`]);
    await pool.query("DELETE FROM customers WHERE name LIKE $1", [`${marker}%`]);
    await removeFixtures(fixtures);
});

type Case = {
    label: string;
    body: Record<string, unknown>;
    // 201 means accepted (200 when updating). 400 needs the exact message.
    status: 201 | 400;
    message?: string;
};

// Text of an exact length that starts with the marker
const textOfLength = (length: number) =>
    marker + "x".repeat(length - marker.length);

// Sends every case to create (POST) and to update (PUT),
// and lists the answers that are not the expected ones
const findWrongAnswers = async (
    base: string,
    updateId: number,
    cases: Case[]
): Promise<string[]> => {
    const wrong: string[] = [];

    for (const testCase of cases) {
        for (const [method, url] of [
            ["post", base],
            ["put", `${base}/${updateId}`]
        ] as const) {
            const response = await request(app)[method](url)
                .set("Authorization", `Bearer ${fixtures.token}`)
                .send(testCase.body);

            const expectedStatus =
                testCase.status === 201 && method === "put"
                    ? 200
                    : testCase.status;

            const sameMessage =
                testCase.message === undefined ||
                response.body.message === testCase.message;

            if (response.status !== expectedStatus || !sameMessage) {
                wrong.push(
                    `${method.toUpperCase()} ${testCase.label} -> ${response.status} ${response.body.message ?? ""}`.trim()
                );
            }
        }
    }

    return wrong;
};

describe("Input limits", () => {
    it("products: values that do not fit the database get 400, never 500", async () => {
        const product = (changes: Record<string, unknown>) => ({
            name: `${marker} product`,
            price: 1,
            stock_quantity: 1,
            ...changes
        });

        const cases: Case[] = [
            {
                label: "name of 100 characters",
                body: product({ name: textOfLength(100) }),
                status: 201
            },
            {
                label: "name of 101 characters",
                body: product({ name: textOfLength(101) }),
                status: 400,
                message: "Product name must be 100 characters or fewer"
            },
            {
                label: "price 99999999.99",
                body: product({ price: 99999999.99 }),
                status: 201
            },
            {
                label: "price 100000000",
                body: product({ price: 100000000 }),
                status: 400,
                message: "Price must be 99999999.99 or less"
            },
            {
                label: "price 19.999",
                body: product({ price: 19.999 }),
                status: 400,
                message: "Price can have at most 2 decimal places"
            },
            {
                label: "stock 2147483647",
                body: product({ stock_quantity: 2147483647 }),
                status: 201
            },
            {
                label: "stock 2147483648",
                body: product({ stock_quantity: 2147483648 }),
                status: 400,
                message: "Stock quantity must be 2147483647 or less"
            }
        ];

        expect(
            await findWrongAnswers("/api/products", fixtures.productId, cases)
        ).toEqual([]);
    });

    it("customers: values that do not fit the database get 400, never 500", async () => {
        const name = `${marker} customer`;
        const email = (length: number) =>
            "e".repeat(length - "@example.com".length) + "@example.com";

        const cases: Case[] = [
            {
                label: "name of 100 characters",
                body: { name: textOfLength(100) },
                status: 201
            },
            {
                label: "name of 101 characters",
                body: { name: textOfLength(101) },
                status: 400,
                message: "Name must be 100 characters or fewer"
            },
            {
                label: "phone of 20 characters",
                body: { name, phone: "0".repeat(20) },
                status: 201
            },
            {
                label: "phone of 21 characters",
                body: { name, phone: "0".repeat(21) },
                status: 400,
                message: "Phone must be 20 characters or fewer"
            },
            {
                label: "email of 100 characters",
                body: { name, email: email(100) },
                status: 201
            },
            {
                label: "email of 101 characters",
                body: { name, email: email(101) },
                status: 400,
                message: "Email must be 100 characters or fewer"
            },
            {
                label: "phone as a number",
                body: { name, phone: 911223344 },
                status: 400,
                message: "Invalid customer data"
            },
            {
                label: "email as a number",
                body: { name, email: 5 },
                status: 400,
                message: "Invalid customer data"
            },
            {
                label: "phone as null",
                body: { name, phone: null },
                status: 400,
                message: "Invalid customer data"
            },
            {
                label: "email as null",
                body: { name, email: null },
                status: 400,
                message: "Invalid customer data"
            }
        ];

        expect(
            await findWrongAnswers("/api/customers", fixtures.customerId, cases)
        ).toEqual([]);
    });
});
