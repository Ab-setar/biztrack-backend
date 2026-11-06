import {
    describe,
    it,
    expect,
    beforeAll,
    afterAll
} from "vitest";
import pool from "../src/db/database.js";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../src/app.js";

let testUserId: number;
let testCustomerId: number;
let testProductId: number;
let salesToken: string;

beforeAll(async () => {
    if (process.env.DB_NAME !== "biztrack_test") {
        throw new Error(
            "Tests must run against the biztrack_test database"
        );
    }

    const userResult = await pool.query(
        `INSERT INTO users (name, email, password, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [
            "BizTrack Test User",
            "biztrack-test-user@example.com",
            "test-password-hash",
            "owner"
        ]
    );

    testUserId = userResult.rows[0].id;

    salesToken = jwt.sign(
        { userId: testUserId, role: "owner" },
        process.env.JWT_SECRET as string
    );

    const customerResult = await pool.query(
        `INSERT INTO customers (name, email)
         VALUES ($1, $2)
         RETURNING id`,
        [
            "BizTrack Test Customer",
            "biztrack-test@example.com"
        ]
    );

    testCustomerId = customerResult.rows[0].id;

    const productResult = await pool.query(
        `INSERT INTO products (name, price, stock_quantity)
         VALUES ($1, $2, $3)
         RETURNING id`,
        ["Laptop Pro", 100, 10]
    );

    testProductId = productResult.rows[0].id;
});

afterAll(async () => {
    if (process.env.DB_NAME !== "biztrack_test") {
        throw new Error(
            "Refusing to clean up outside biztrack_test"
        );
    }

    try {
        if (testCustomerId && testUserId) {
            await pool.query(
                `DELETE FROM sale_items
                 WHERE sale_id IN (
                     SELECT id FROM sales
                     WHERE customer_id = $1 AND user_id = $2
                 )`,
                [testCustomerId, testUserId]
            );

            await pool.query(
                `DELETE FROM sales
                 WHERE customer_id = $1 AND user_id = $2`,
                [testCustomerId, testUserId]
            );
        }

        if (testCustomerId) {
            await pool.query(
                "DELETE FROM customers WHERE id = $1",
                [testCustomerId]
            );
        }

        if (testProductId) {
            await pool.query(
                "DELETE FROM products WHERE id = $1",
                [testProductId]
            );
        }

        if (testUserId) {
            await pool.query(
                "DELETE FROM users WHERE id = $1",
                [testUserId]
            );
        }
    } finally {
        await pool.end();
    }
});

describe("GET /health", () => {
    it("returns a successful health response", async () => {
        const response = await request(app).get("/health");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            success: true,
            message: "BizTrack API is healthy"
        });
    });
});

describe("Authentication validation", () => {
    it("rejects registration when required fields are missing", async () => {
        const response = await request(app)
            .post("/api/auth/register")
            .send({ email: "test@example.com" });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            message: "Name, email and password are required"
        });
    });

    it("rejects login when required fields are missing", async () => {
        const response = await request(app)
            .post("/api/auth/login")
            .send({ email: "test@example.com" });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            message: "Email and password are required"
        });
    });
});

describe("Product API validation", () => {
    const token = jwt.sign(
        { userId: 1, role: "owner" },
        process.env.JWT_SECRET as string
    );

    it("rejects product requests without authentication", async () => {
        const response = await request(app)
            .get("/api/products");

        expect(response.status).toBe(401);
        expect(response.body.message).toBe(
            "Authentication required"
        );
    });

    it("rejects an invalid JWT", async () => {
        const response = await request(app)
            .get("/api/products")
            .set("Authorization", "Bearer invalid.token.value");

        expect(response.status).toBe(401);
        expect(response.body.message).toBe(
            "Invalid or expired token"
        );
    });

    it("rejects an expired JWT", async () => {
        const expiredToken = jwt.sign(
            { userId: 1, role: "owner" },
            process.env.JWT_SECRET as string,
            { expiresIn: -1 }
        );

        const response = await request(app)
            .get("/api/products")
            .set("Authorization", `Bearer ${expiredToken}`);

        expect(response.status).toBe(401);
        expect(response.body.message).toBe(
            "Invalid or expired token"
        );
    });

    // Malformed JWT payload tests

    it("rejects a JWT with a missing userId", async () => {
        const malformedToken = jwt.sign(
            { role: "owner" },
            process.env.JWT_SECRET as string
        );

        const response = await request(app)
            .get("/api/products")
            .set("Authorization", `Bearer ${malformedToken}`);

        expect(response.status).toBe(401);
        expect(response.body.message).toBe("Invalid token");
    });

    it("rejects a JWT with a string userId", async () => {
        const malformedToken = jwt.sign(
            { userId: "1", role: "owner" },
            process.env.JWT_SECRET as string
        );

        const response = await request(app)
            .get("/api/products")
            .set("Authorization", `Bearer ${malformedToken}`);

        expect(response.status).toBe(401);
        expect(response.body.message).toBe("Invalid token");
    });

    it("rejects a JWT with a zero userId", async () => {
        const malformedToken = jwt.sign(
            { userId: 0, role: "owner" },
            process.env.JWT_SECRET as string
        );

        const response = await request(app)
            .get("/api/products")
            .set("Authorization", `Bearer ${malformedToken}`);

        expect(response.status).toBe(401);
        expect(response.body.message).toBe("Invalid token");
    });

    it("rejects a JWT with a negative userId", async () => {
        const malformedToken = jwt.sign(
            { userId: -1, role: "owner" },
            process.env.JWT_SECRET as string
        );

        const response = await request(app)
            .get("/api/products")
            .set("Authorization", `Bearer ${malformedToken}`);

        expect(response.status).toBe(401);
        expect(response.body.message).toBe("Invalid token");
    });

    it("rejects a JWT with a missing role", async () => {
        const malformedToken = jwt.sign(
            { userId: 1 },
            process.env.JWT_SECRET as string
        );

        const response = await request(app)
            .get("/api/products")
            .set("Authorization", `Bearer ${malformedToken}`);

        expect(response.status).toBe(401);
        expect(response.body.message).toBe("Invalid token");
    });

    it("rejects a JWT with an empty role", async () => {
        const malformedToken = jwt.sign(
            { userId: 1, role: "" },
            process.env.JWT_SECRET as string
        );

        const response = await request(app)
            .get("/api/products")
            .set("Authorization", `Bearer ${malformedToken}`);

        expect(response.status).toBe(401);
        expect(response.body.message).toBe("Invalid token");
    });

    it("rejects a JWT with an unsupported role", async () => {
        const malformedToken = jwt.sign(
            { userId: 1, role: "superadmin" },
            process.env.JWT_SECRET as string
        );

        const response = await request(app)
            .get("/api/products")
            .set("Authorization", `Bearer ${malformedToken}`);

        expect(response.status).toBe(401);
        expect(response.body.message).toBe("Invalid token");
    });

    it("rejects a JWT with an incorrectly capitalized role", async () => {
        const malformedToken = jwt.sign(
            { userId: 1, role: "OWNER" },
            process.env.JWT_SECRET as string
        );

        const response = await request(app)
            .get("/api/products")
            .set("Authorization", `Bearer ${malformedToken}`);

        expect(response.status).toBe(401);
        expect(response.body.message).toBe("Invalid token");
    });

    it("rejects a JWT with whitespace in its role", async () => {
        const malformedToken = jwt.sign(
            { userId: 1, role: "owner " },
            process.env.JWT_SECRET as string
        );

        const response = await request(app)
            .get("/api/products")
            .set("Authorization", `Bearer ${malformedToken}`);

        expect(response.status).toBe(401);
        expect(response.body.message).toBe("Invalid token");
    });

    it("rejects invalid product data", async () => {
        const response = await request(app)
            .post("/api/products")
            .set("Authorization", `Bearer ${token}`)
            .send({
                name: "",
                price: -10,
                stock_quantity: 2
            });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe(
            "Invalid product data"
        );
    });

    it("rejects invalid pagination parameters", async () => {
        const response = await request(app)
            .get("/api/products?page=0")
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(400);
        expect(response.body.message).toBe(
            "Invalid pagination parameters"
        );
    });

    it("rejects product deletion by an employee", async () => {
        const employeeToken = jwt.sign(
            { userId: 1, role: "employee" },
            process.env.JWT_SECRET as string
        );

        const response = await request(app)
            .delete("/api/products/999999999")
            .set("Authorization", `Bearer ${employeeToken}`);

        expect(response.status).toBe(403);
        expect(response.body.message).toBe(
            "You do not have permission to perform this action"
        );
    });

    it("allows an owner to reach the product deletion controller", async () => {
        const response = await request(app)
            .delete("/api/products/999999999")
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(404);
        expect(response.body.message).toBe(
            "Product not found"
        );
    });
});

describe("Customer API validation", () => {
    const token = jwt.sign(
        { userId: 1, role: "owner" },
        process.env.JWT_SECRET as string
    );

    it("rejects customer requests without authentication", async () => {
        const response = await request(app)
            .get("/api/customers");

        expect(response.status).toBe(401);
        expect(response.body.message).toBe(
            "Authentication required"
        );
    });

    it("rejects customer data with a missing name", async () => {
        const response = await request(app)
            .post("/api/customers")
            .set("Authorization", `Bearer ${token}`)
            .send({
                name: "   ",
                phone: "0912345678",
                email: "customer@example.com"
            });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe(
            "Invalid customer data"
        );
    });

    it("rejects an invalid customer email", async () => {
        const response = await request(app)
            .post("/api/customers")
            .set("Authorization", `Bearer ${token}`)
            .send({
                name: "Abebe",
                email: "not-an-email"
            });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe(
            "Invalid email address"
        );
    });

    it("rejects invalid customer pagination", async () => {
        const response = await request(app)
            .get("/api/customers?page=0")
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(400);
        expect(response.body.message).toBe(
            "Invalid pagination parameters"
        );
    });

    it("returns 404 when a customer does not exist", async () => {
        const response = await request(app)
            .get("/api/customers/999999999")
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(404);
        expect(response.body.message).toBe(
            "Customer not found"
        );
    });
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
