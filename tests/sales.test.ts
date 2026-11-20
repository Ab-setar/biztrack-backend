import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pool from "../src/db/database.js";
import request from "supertest";
import app from "../src/app.js";
import { createFixtures, removeFixtures, type Fixtures } from "./helpers/fixtures.js";

let fixtures: Fixtures | undefined;
let testCustomerId: number;
let testProductId: number;
let salesToken: string;

beforeAll(async () => {
    const created = await createFixtures("sales");
    fixtures = created;
    testCustomerId = created.customerId;
    testProductId = created.productId;
    salesToken = created.token;
});

afterAll(async () => {
    await removeFixtures(fixtures);
});

describe("Sales API validation", () => {
    it("creates a sale and decreases product stock", async () => {
        const response = await request(app)
            .post("/api/sales")
            .set("Authorization", `Bearer ${salesToken}`)
            .send({
                customer_id: testCustomerId,
                items: [
                    {
                        product_id: testProductId,
                        quantity: 2
                    }
                ]
            });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.sale.total_amount).toBe("200.00");

        const productResult = await pool.query(
            "SELECT stock_quantity FROM products WHERE id = $1",
            [testProductId]
        );

        expect(productResult.rows[0].stock_quantity).toBe(8);
    });

    it("rejects sales requests without authentication", async () => {
        const response = await request(app)
            .get("/api/sales");

        expect(response.status).toBe(401);
        expect(response.body.message).toBe(
            "Authentication required"
        );
    });

    it("rejects a sale without valid customer or items", async () => {
        const response = await request(app)
            .post("/api/sales")
            .set("Authorization", `Bearer ${salesToken}`)
            .send({
                customer_id: 0,
                items: []
            });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe(
            "Invalid customer or sale items"
        );
    });

    it("rejects a sale when the customer does not exist", async () => {
        const response = await request(app)
            .post("/api/sales")
            .set("Authorization", `Bearer ${salesToken}`)
            .send({
                customer_id: 999999999,
                items: [
                    {
                        product_id: testProductId,
                        quantity: 1
                    }
                ]
            });

        expect(response.status).toBe(404);
        expect(response.body.message).toBe(
            "Customer not found"
        );
    });

    it("rejects a sale when the product does not exist", async () => {
        const response = await request(app)
            .post("/api/sales")
            .set("Authorization", `Bearer ${salesToken}`)
            .send({
                customer_id: testCustomerId,
                items: [
                    {
                        product_id: 999999999,
                        quantity: 1
                    }
                ]
            });

        expect(response.status).toBe(404);
        expect(response.body.message).toBe(
            "Product 999999999 not found"
        );
    });

    it("rejects a sale when stock is insufficient", async () => {
        const response = await request(app)
            .post("/api/sales")
            .set("Authorization", `Bearer ${salesToken}`)
            .send({
                customer_id: testCustomerId,
                items: [
                    {
                        product_id: testProductId,
                        quantity: 11
                    }
                ]
            });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe(
            "Insufficient stock for Laptop Pro"
        );
    });

    it("rejects invalid sale item quantities", async () => {
        const response = await request(app)
            .post("/api/sales")
            .set("Authorization", `Bearer ${salesToken}`)
            .send({
                customer_id: testCustomerId,
                items: [
                    {
                        product_id: testProductId,
                        quantity: 0
                    }
                ]
            });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe(
            "Invalid sale item data"
        );
    });

    it("rejects duplicate products in a sale", async () => {
        const response = await request(app)
            .post("/api/sales")
            .set("Authorization", `Bearer ${salesToken}`)
            .send({
                customer_id: testCustomerId,
                items: [
                    {
                        product_id: testProductId,
                        quantity: 1
                    },
                    {
                        product_id: testProductId,
                        quantity: 2
                    }
                ]
            });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe(
            "A product cannot appear more than once in a sale"
        );
    });

    it("rejects invalid sales pagination", async () => {
        const response = await request(app)
            .get("/api/sales?page=0")
            .set("Authorization", `Bearer ${salesToken}`);

        expect(response.status).toBe(400);
        expect(response.body.message).toBe(
            "Invalid pagination parameters"
        );
    });

    it("rejects an invalid customer_id filter", async () => {
        const response = await request(app)
            .get("/api/sales?customer_id=0")
            .set("Authorization", `Bearer ${salesToken}`);

        expect(response.status).toBe(400);
        expect(response.body.message).toBe(
            "Invalid customer_id"
        );
    });
});

describe("Sales concurrency", () => {
    it("allows only one sale when several employees buy the last item at once", async () => {
        const productResult = await pool.query(
            `INSERT INTO products (name, price, stock_quantity)
             VALUES ($1, $2, $3)
             RETURNING id`,
            ["Last Item Test Product", 50, 1]
        );

        const productId = productResult.rows[0].id;

        try {
            const attempts = 5;

            const responses = await Promise.all(
                Array.from({ length: attempts }, () =>
                    request(app)
                        .post("/api/sales")
                        .set("Authorization", `Bearer ${salesToken}`)
                        .send({
                            customer_id: testCustomerId,
                            items: [
                                {
                                    product_id: productId,
                                    quantity: 1
                                }
                            ]
                        })
                )
            );

            const statuses = responses.map((response) => response.status);

            expect(statuses.filter((status) => status === 201)).toHaveLength(1);
            expect(statuses.filter((status) => status === 400)).toHaveLength(attempts - 1);

            const stockResult = await pool.query(
                "SELECT stock_quantity FROM products WHERE id = $1",
                [productId]
            );

            expect(stockResult.rows[0].stock_quantity).toBe(0);
        } finally {
            await pool.query(
                `DELETE FROM sales
                 WHERE id IN (
                     SELECT sale_id FROM sale_items WHERE product_id = $1
                 )`,
                [productId]
            );

            await pool.query(
                "DELETE FROM products WHERE id = $1",
                [productId]
            );
        }
    });
});

describe("Delete conflicts", () => {
    it("blocks deleting a product or customer that has sales", async () => {
        const unique = Date.now();

        const customerResult = await pool.query(
            `INSERT INTO customers (name, email)
             VALUES ($1, $2)
             RETURNING id`,
            ["Conflict Test Customer", `conflict-${unique}@example.com`]
        );

        const productResult = await pool.query(
            `INSERT INTO products (name, price, stock_quantity)
             VALUES ($1, $2, $3)
             RETURNING id`,
            ["Conflict Test Product", 20, 5]
        );

        const customerId = customerResult.rows[0].id;
        const productId = productResult.rows[0].id;

        try {
            const saleResponse = await request(app)
                .post("/api/sales")
                .set("Authorization", `Bearer ${salesToken}`)
                .send({
                    customer_id: customerId,
                    items: [{ product_id: productId, quantity: 1 }]
                });

            expect(saleResponse.status).toBe(201);

            const productDelete = await request(app)
                .delete(`/api/products/${productId}`)
                .set("Authorization", `Bearer ${salesToken}`);

            expect(productDelete.status).toBe(409);
            expect(productDelete.body.message).toBe(
                "Product cannot be deleted because it is used in existing sales"
            );

            const customerDelete = await request(app)
                .delete(`/api/customers/${customerId}`)
                .set("Authorization", `Bearer ${salesToken}`);

            expect(customerDelete.status).toBe(409);
            expect(customerDelete.body.message).toBe(
                "Customer cannot be deleted because they have existing sales"
            );
        } finally {
            await pool.query(
                `DELETE FROM sales WHERE customer_id = $1`,
                [customerId]
            );
            await pool.query("DELETE FROM products WHERE id = $1", [productId]);
            await pool.query("DELETE FROM customers WHERE id = $1", [customerId]);
        }
    });
});

describe("Sales deadlock prevention", () => {
    it("handles sales that list the same products in opposite order", async () => {
        const productIds: number[] = [];

        for (const name of ["Deadlock Test Product A", "Deadlock Test Product B"]) {
            const result = await pool.query(
                `INSERT INTO products (name, price, stock_quantity)
                 VALUES ($1, $2, $3)
                 RETURNING id`,
                [name, 10, 100]
            );

            productIds.push(result.rows[0].id);
        }

        const [productA, productB] = productIds;

        try {
            const sendSale = (items: { product_id: number; quantity: number }[]) =>
                request(app)
                    .post("/api/sales")
                    .set("Authorization", `Bearer ${salesToken}`)
                    .send({ customer_id: testCustomerId, items });

            const requests = [];

            for (let i = 0; i < 10; i++) {
                requests.push(
                    sendSale([
                        { product_id: productA, quantity: 1 },
                        { product_id: productB, quantity: 1 }
                    ])
                );

                requests.push(
                    sendSale([
                        { product_id: productB, quantity: 1 },
                        { product_id: productA, quantity: 1 }
                    ])
                );
            }

            const responses = await Promise.all(requests);

            expect(responses.map((response) => response.status)).toEqual(
                Array(20).fill(201)
            );

            const stockResult = await pool.query(
                `SELECT stock_quantity
                 FROM products
                 WHERE id = ANY($1)`,
                [productIds]
            );

            expect(stockResult.rows.map((row) => row.stock_quantity)).toEqual([80, 80]);
        } finally {
            await pool.query(
                `DELETE FROM sales
                 WHERE id IN (
                     SELECT sale_id FROM sale_items WHERE product_id = ANY($1)
                 )`,
                [productIds]
            );

            await pool.query(
                "DELETE FROM products WHERE id = ANY($1)",
                [productIds]
            );
        }
    }, 30000);
});
