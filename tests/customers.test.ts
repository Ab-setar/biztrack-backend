import { describe, it, expect } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../src/app.js";

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
