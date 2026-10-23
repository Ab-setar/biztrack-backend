
import { describe, it, expect } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../src/app.js";

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

