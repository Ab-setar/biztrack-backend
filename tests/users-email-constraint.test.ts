import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pool from "../src/db/database.js";
import { isDbErrorCode } from "../src/utils/dbErrors.js";

const email = `case-test-${randomUUID().slice(0, 8)}@example.com`;

beforeAll(() => {
    // This file inserts rows directly, so it may only run on the test database
    if (process.env.DB_NAME !== "biztrack_test") {
        throw new Error("Tests must run against the biztrack_test database");
    }
});

afterAll(async () => {
    try {
        await pool.query("DELETE FROM users WHERE lower(email) = $1", [email]);
    } finally {
        await pool.end();
    }
});

const insertUser = (address: string) =>
    pool.query(
        `INSERT INTO users (name, email, password, role)
         VALUES ($1, $2, $3, 'employee')`,
        ["Case Test", address, "test-password-hash"]
    );

describe("users.email uniqueness", () => {
    it("refuses an email that differs only in letter case", async () => {
        await insertUser(email);

        let error: unknown;

        try {
            await insertUser(email.toUpperCase());
        } catch (caught) {
            error = caught;
        }

        expect(isDbErrorCode(error, "23505")).toBe(true);

        const rows = await pool.query(
            "SELECT id FROM users WHERE lower(email) = $1",
            [email]
        );

        expect(rows.rows).toHaveLength(1);
    });
});
