import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import pool from "../../src/db/database.js";
import { config } from "../../src/config.js";

export type Fixtures = {
    userId: number;
    customerId: number;
    productId: number;
    token: string;
};

// Tests insert and delete rows, so they may only run on the test database
const assertTestDatabase = (): void => {
    if (process.env.DB_NAME !== "biztrack_test") {
        throw new Error("Tests must run against the biztrack_test database");
    }
};

// Creates an owner user, a customer and a product for one test file.
// The random part keeps the rows unique, so a crashed earlier run
// can never block this one.
export const createFixtures = async (tag: string): Promise<Fixtures> => {
    assertTestDatabase();

    const unique = `${tag}-${randomUUID().slice(0, 8)}`;

    const userResult = await pool.query(
        `INSERT INTO users (name, email, password, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [
            "BizTrack Test User",
            `biztrack-test-user-${unique}@example.com`,
            "test-password-hash",
            "owner"
        ]
    );

    const userId: number = userResult.rows[0].id;

    const customerResult = await pool.query(
        `INSERT INTO customers (name, email)
         VALUES ($1, $2)
         RETURNING id`,
        ["BizTrack Test Customer", `biztrack-test-${unique}@example.com`]
    );

    const customerId: number = customerResult.rows[0].id;

    const productResult = await pool.query(
        `INSERT INTO products (name, price, stock_quantity)
         VALUES ($1, $2, $3)
         RETURNING id`,
        ["Laptop Pro", 100, 10]
    );

    const productId: number = productResult.rows[0].id;

    const token = jwt.sign({ userId, role: "owner" }, config.jwtSecret);

    return { userId, customerId, productId, token };
};

// Removes what createFixtures made, plus the sales the tests created with it,
// then closes the database connections of this test file.
export const removeFixtures = async (
    fixtures: Fixtures | undefined
): Promise<void> => {
    assertTestDatabase();

    try {
        if (fixtures) {
            const { userId, customerId, productId } = fixtures;

            await pool.query(
                `DELETE FROM sale_items
                 WHERE sale_id IN (
                     SELECT id FROM sales
                     WHERE customer_id = $1 AND user_id = $2
                 )`,
                [customerId, userId]
            );

            await pool.query(
                `DELETE FROM sales
                 WHERE customer_id = $1 AND user_id = $2`,
                [customerId, userId]
            );

            await pool.query("DELETE FROM customers WHERE id = $1", [customerId]);
            await pool.query("DELETE FROM products WHERE id = $1", [productId]);
            await pool.query("DELETE FROM users WHERE id = $1", [userId]);
        }
    } finally {
        await pool.end();
    }
};
