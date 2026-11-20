import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import { config } from "../src/config.js";
import { createFixtures, removeFixtures, type Fixtures } from "./helpers/fixtures.js";

let fixtures: Fixtures | undefined;
let testUserId: number;
let salesToken: string;

beforeAll(async () => {
    const created = await createFixtures("http");
    fixtures = created;
    testUserId = created.userId;
    salesToken = created.token;
});

afterAll(async () => {
    await removeFixtures(fixtures);
});

describe("Invalid id handling", () => {
    it("returns 400 for ids that are not positive 32-bit integers", async () => {
        const badIds = ["abc", "0", "-5", "1.5", "99999999999"];

        const endpoints = [
            { method: "get", base: "/api/products" },
            {
                method: "put",
                base: "/api/products",
                body: { name: "Id Test Product", price: 1, stock_quantity: 1 }
            },
            { method: "delete", base: "/api/products" },
            { method: "get", base: "/api/customers" },
            {
                method: "put",
                base: "/api/customers",
                body: { name: "Id Test Customer" }
            },
            { method: "delete", base: "/api/customers" },
            { method: "get", base: "/api/sales" }
        ] as const;

        const failures: string[] = [];

        for (const endpoint of endpoints) {
            for (const id of badIds) {
                const pending = request(app)
                    [endpoint.method](`${endpoint.base}/${id}`)
                    .set("Authorization", `Bearer ${salesToken}`);

                const response =
                    "body" in endpoint
                        ? await pending.send(endpoint.body)
                        : await pending;

                if (response.status !== 400) {
                    failures.push(
                        `${endpoint.method.toUpperCase()} ${endpoint.base}/${id} -> ${response.status}`
                    );
                }
            }
        }

        expect(failures).toEqual([]);
    });
});

describe("Request limits and CORS", () => {
    it("answers malformed and oversized JSON with 4xx, not 500", async () => {
        const malformed = await request(app)
            .post("/api/auth/login")
            .set("Content-Type", "application/json")
            .send('{"email": ');

        expect(malformed.status).toBe(400);
        expect(malformed.body).toEqual({
            success: false,
            message: "Invalid JSON in request body"
        });

        const oversized = await request(app)
            .post("/api/auth/login")
            .send({ email: "a@example.com", password: "x".repeat(150_000) });

        expect(oversized.status).toBe(413);
        expect(oversized.body).toEqual({
            success: false,
            message: "Request body is too large"
        });
    });

    it("lets only the configured origins read API responses in a browser", async () => {
        const allowedOrigin = config.corsOrigins[0];

        expect(allowedOrigin).toBeDefined();

        const allowed = await request(app)
            .get("/health")
            .set("Origin", allowedOrigin);

        expect(allowed.headers["access-control-allow-origin"]).toBe(allowedOrigin);

        const blocked = await request(app)
            .get("/health")
            .set("Origin", "https://evil.example");

        expect(blocked.status).toBe(200);
        expect(blocked.headers["access-control-allow-origin"]).toBeUndefined();
    });
});

describe("Consistent response shape", () => {
    it("answers every kind of error with { success: false, message }", async () => {
        const employeeToken = jwt.sign(
            { userId: testUserId, role: "employee" },
            config.jwtSecret
        );
        const owner = `Bearer ${salesToken}`;

        const responses = await Promise.all([
            request(app).get("/api/products"),
            request(app)
                .get("/api/products")
                .set("Authorization", "Bearer not-a-token"),
            request(app)
                .get("/api/products")
                .set("Authorization", "Basic abc"),
            request(app)
                .delete("/api/products/1")
                .set("Authorization", `Bearer ${employeeToken}`),
            request(app).post("/api/auth/login").send({}),
            request(app)
                .post("/api/auth/login")
                .send({ email: "nobody@example.com", password: "wrong-password-1" }),
            request(app).get("/api/products/abc").set("Authorization", owner),
            request(app).get("/api/does-not-exist").set("Authorization", owner)
        ]);

        expect(responses.map((response) => response.status)).toEqual([
            401, 401, 401, 403, 400, 401, 400, 404
        ]);

        for (const response of responses) {
            expect(Object.keys(response.body).sort()).toEqual(["message", "success"]);
            expect(response.body.success).toBe(false);
            expect(typeof response.body.message).toBe("string");
        }
    });

    it("documents one error shape", async () => {
        const response = await request(app).get("/api-docs/openapi.json");

        expect(JSON.stringify(response.body)).not.toContain("MessageOnly");
    });
});
