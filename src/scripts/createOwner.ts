import bcrypt from "bcrypt";
import pool from "../db/database.js";
import { BCRYPT_ROUNDS } from "../constants/security.js";
import { isDbErrorCode } from "../utils/dbErrors.js";
import { validateRegisterInput } from "../validators/authValidator.js";

// Creates an owner account. Use it once on a new database.
// Set OWNER_NAME, OWNER_EMAIL and OWNER_PASSWORD, then run:
//   node dist/scripts/createOwner.js
const run = async (): Promise<void> => {
    const parsed = validateRegisterInput({
        name: process.env.OWNER_NAME,
        email: process.env.OWNER_EMAIL,
        password: process.env.OWNER_PASSWORD
    });

    if (!parsed.ok) {
        throw new Error(parsed.message);
    }

    const { name, email, password } = parsed.value;
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    try {
        const result = await pool.query(
            `INSERT INTO users (name, email, password, role)
             VALUES ($1, $2, $3, 'owner')
             RETURNING id, email`,
            [name, email, passwordHash]
        );

        console.log(
            `Owner created: id ${result.rows[0].id}, ${result.rows[0].email}`
        );
    } catch (error) {
        if (isDbErrorCode(error, "23505")) {
            throw new Error("An account with this email already exists");
        }

        throw error;
    }
};

run()
    .catch((error: unknown) => {
        console.error(
            "Failed:",
            error instanceof Error ? error.message : error
        );
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
