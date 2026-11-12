import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../db/database.js";
import { config } from "../config.js";
import { logError } from "../utils/logger.js";
import { isDbErrorCode } from "../utils/dbErrors.js";
import {
    validateRegisterInput,
    validateLoginInput
} from "../validators/authValidator.js";

const BCRYPT_ROUNDS = 10;

// Used when the email is unknown, so login takes about the same time
// whether or not the account exists
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
    "not-a-real-password",
    BCRYPT_ROUNDS
);

export const registerUser = async (req: Request, res: Response) => {
    try {
        const parsed = validateRegisterInput(req.body);

        if (!parsed.ok) {
            return res.status(400).json({ message: parsed.message });
        }

        const { name, email, password } = parsed.value;

        // Quick check. The UNIQUE constraint on users.email is the real protection.
        const existingUser = await pool.query(
            `SELECT id
             FROM users
             WHERE lower(email) = $1`,
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                message: "Email already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

        const result = await pool.query(
            `INSERT INTO users
             (name, email, password, role)
             VALUES ($1, $2, $3, 'employee')
             RETURNING id, name, email, role, created_at`,
            [name, email, hashedPassword]
        );

        return res.status(201).json({
            message: "User registered successfully",
            user: result.rows[0]
        });

    } catch (error) {
        // Two requests with the same email at the same moment:
        // the database refuses the second one
        if (isDbErrorCode(error, "23505")) {
            return res.status(409).json({
                message: "Email already exists"
            });
        }

        logError(res, error);

        return res.status(500).json({
            message: "Failed to register user"
        });
    }
};

export const loginUser = async (req: Request, res: Response) => {
    try {
        const parsed = validateLoginInput(req.body);

        if (!parsed.ok) {
            return res.status(400).json({ message: parsed.message });
        }

        const { email, password } = parsed.value;

        const result = await pool.query(
            `SELECT *
             FROM users
             WHERE lower(email) = $1`,
            [email]
        );

        const user = result.rows[0];

        // Always run one bcrypt comparison, also when the email is unknown
        const passwordMatch = await bcrypt.compare(
            password,
            user ? user.password : DUMMY_PASSWORD_HASH
        );

        if (!user || !passwordMatch) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const token = jwt.sign(
            {
                userId: user.id,
                role: user.role
            },
            config.jwtSecret,
            {
                algorithm: "HS256",
                expiresIn: "1h"
            }
        );

        return res.status(200).json({
            message: "Login successful",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        logError(res, error);

        return res.status(500).json({
            message: "Failed to login"
        });
    }
};
