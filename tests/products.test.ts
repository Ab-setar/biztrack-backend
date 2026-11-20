import { describe, it, expect } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../src/app.js";

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
