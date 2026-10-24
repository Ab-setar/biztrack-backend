
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
let testCustomerId: number;
let testProductId: number;

beforeAll(async () => {
    if (process.env.DB_NAME !== "biztrack_test") {
        throw new Error(
            "Tests must run against the biztrack_test database"
        );
    }

    const customerResult = await pool.query(
        `INSERT INTO customers (name, email)
         VALUES ($1, $2)
         RETURNING id`,
        ["BizTrack Test Customer", "biztrack-test@example.com"]
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
        { id: 1, role: "owner" },
        process.env.JWT_SECRET as string
    );

    it("rejects product requests without authentication", async () => {
        const response = await request(app)
            .get("/api/products");

        expect(response.status).toBe(401);
        expect(response.body.message).toBe("Authentication required");
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
        expect(response.body.message).toBe("Invalid product data");
    });

    it("rejects invalid pagination parameters", async () => {
        const response = await request(app)
            .get("/api/products?page=0")
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Invalid pagination parameters");
    });
});

describe("Customer API validation", () => {
    const token = jwt.sign(
        { id: 1, role: "owner" },
        process.env.JWT_SECRET as string
    );

    it("rejects customer requests without authentication", async () => {
        const response = await request(app)
            .get("/api/customers");

        expect(response.status).toBe(401);
        expect(response.body.message).toBe("Authentication required");
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
        expect(response.body.message).toBe("Invalid customer data");
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
        expect(response.body.message).toBe("Invalid email address");
    });

    it("rejects invalid customer pagination", async () => {
        const response = await request(app)
            .get("/api/customers?page=0")
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Invalid pagination parameters");
    });

    it("returns 404 when a customer does not exist", async () => {
        const response = await request(app)
            .get("/api/customers/999999999")
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(404);
        expect(response.body.message).toBe("Customer not found");
    });
});


describe("Sales API validation", () => {it("creates a sale and decreases product stock", async () => {
    const response = await request(app)
        .post("/api/sales")
        .set("Authorization", `Bearer ${token}`)
        .send({
            customer_id: testCustomerId,
            items: [
                { product_id: testProductId, quantity: 2 }
            ]
        });

    expect(response.status).toBe(201);
    expect(response.body.sale.total_amount).toBe("200.00");

    const productResult = await pool.query(
        "SELECT stock_quantity FROM products WHERE id = $1",
        [testProductId]
    );

    expect(productResult.rows[0].stock_quantity).toBe(8);
});
    const token = jwt.sign(
        { userId: 1, role: "owner" },
        process.env.JWT_SECRET as string
    );

    it("rejects sales requests without authentication", async () => {
        const response = await request(app)
            .get("/api/sales");

        expect(response.status).toBe(401);
        expect(response.body.message).toBe("Authentication required");
    });

    it("rejects a sale without valid customer or items", async () => {
        const response = await request(app)
            .post("/api/sales")
            .set("Authorization", `Bearer ${token}`)
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
        .set("Authorization", `Bearer ${token}`)
        .send({
            customer_id: 999999999,
            items: [
                { product_id: 2, quantity: 1 }
            ]
        });

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Customer not found");
});
it("rejects a sale when the product does not exist", async () => {
    const response = await request(app)
        .post("/api/sales")
        .set("Authorization", `Bearer ${token}`)
        .send({
            customer_id: testCustomerId,
            items: [
                { product_id: 999999999, quantity: 1 }
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
        .set("Authorization", `Bearer ${token}`)
        .send({
    customer_id: testCustomerId,
    items: [
        { product_id: testProductId, quantity: 11 }
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
            .set("Authorization", `Bearer ${token}`)
            .send({
                customer_id: 1,
                items: [
                    { product_id: 1, quantity: 0 }
                ]
            });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Invalid sale item data");
    });

    it("rejects duplicate products in a sale", async () => {
        const response = await request(app)
            .post("/api/sales")
            .set("Authorization", `Bearer ${token}`)
            .send({
                customer_id: 1,
                items: [
                    { product_id: 1, quantity: 1 },
                    { product_id: 1, quantity: 2 }
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
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(400);
        expect(response.body.message).toBe(
            "Invalid pagination parameters"
        );
    });

    it("rejects an invalid customer_id filter", async () => {
        const response = await request(app)
            .get("/api/sales?customer_id=0")
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Invalid customer_id");
    });
});
