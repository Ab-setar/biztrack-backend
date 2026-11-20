import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pool from "../src/db/database.js";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import { config } from "../src/config.js";
import { createFixtures, removeFixtures, type Fixtures } from "./helpers/fixtures.js";

let fixtures: Fixtures | undefined;
let testUserId: number;
let salesToken: string;

beforeAll(async () => {
    const created = await createFixtures("auth");
    fixtures = created;
    testUserId = created.userId;
    salesToken = created.token;
});

afterAll(async () => {
    await removeFixtures(fixtures);
});

describe("Authentication validation", () => {
    it("rejects registration when required fields are missing", async () => {
        const response = await request(app)
            .post("/api/auth/register")
            .set("Authorization", `Bearer ${salesToken}`)
            .send({ email: "test@example.com" });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            success: false,
            message: "Name, email and password are required"
        });
    });

    it("rejects login when required fields are missing", async () => {
        const response = await request(app)
            .post("/api/auth/login")
            .send({ email: "test@example.com" });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            success: false,
            message: "Email and password are required"
        });
    });
});

// The register limiter is switched off when NODE_ENV is "test".
describe("Registration and login rules", () => {
    it("rejects weak or malformed registration input", async () => {
        const cases = [
            {
                body: { name: "Test User", email: "rules-test@example.com", password: "short" },
                message: "Password must be at least 8 characters long"
            },
            {
                body: { name: "Test User", email: "not-an-email", password: "long-enough-password" },
                message: "Invalid email address"
            },
            {
                body: { name: 123, email: {}, password: ["x"] },
                message: "Name, email and password are required"
            },
            {
                body: { name: "Test User", email: "rules-test@example.com", password: "a".repeat(73) },
                message: "Password must be 72 bytes or fewer"
            }
        ];

        for (const { body, message } of cases) {
            const response = await request(app)
                .post("/api/auth/register")
                .set("Authorization", `Bearer ${salesToken}`)
                .send(body);

            expect(response.status).toBe(400);
            expect(response.body).toEqual({ success: false, message });
        }
    });

    it("creates one account for simultaneous duplicate registrations, then logs in", async () => {
        const email = `Rules.Test.${Date.now()}@Example.com`;
        const password = "correct-horse-battery";

        try {
            const responses = await Promise.all(
                [email, email.toLowerCase(), `  ${email}  `].map((address) =>
                    request(app)
                        .post("/api/auth/register")
                        .set("Authorization", `Bearer ${salesToken}`)
                        .send({ name: "Rules Test", email: address, password })
                )
            );

            expect(responses.map((response) => response.status).sort()).toEqual([201, 409, 409]);

            const created = responses.find((response) => response.status === 201)!;

            expect(created.body.data.user.email).toBe(email.toLowerCase());
            expect(created.body.data.user.role).toBe("employee");
            expect(created.body.data.user).not.toHaveProperty("password");

            const login = await request(app)
                .post("/api/auth/login")
                .send({ email: email.toUpperCase(), password });

            expect(login.status).toBe(200);
            expect(typeof login.body.data.token).toBe("string");

            const wrongPassword = await request(app)
                .post("/api/auth/login")
                .send({ email, password: "wrong-password-123" });

            expect(wrongPassword.status).toBe(401);
            expect(wrongPassword.body).toEqual({ success: false, message: "Invalid email or password" });
        } finally {
            await pool.query(
                "DELETE FROM users WHERE lower(email) = $1",
                [email.toLowerCase()]
            );
        }
    });
});

describe("Account creation is owner only", () => {
    it("rejects registration without a token and with an employee token", async () => {
        const body = {
            name: "Blocked User",
            email: "blocked-user@example.com",
            password: "long-enough-password"
        };

        const anonymous = await request(app)
            .post("/api/auth/register")
            .send(body);

        expect(anonymous.status).toBe(401);

        const employeeToken = jwt.sign(
            { userId: testUserId, role: "employee" },
            config.jwtSecret
        );

        const employee = await request(app)
            .post("/api/auth/register")
            .set("Authorization", `Bearer ${employeeToken}`)
            .send(body);

        expect(employee.status).toBe(403);

        const created = await pool.query(
            "SELECT id FROM users WHERE email = $1",
            [body.email]
        );

        expect(created.rows).toHaveLength(0);
    });
});
