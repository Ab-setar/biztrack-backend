import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../db/database.js";
import { config } from "../config.js";
import { BCRYPT_ROUNDS } from "../constants/security.js";
import { logError } from "../utils/logger.js";
import { isDbErrorCode } from "../utils/dbErrors.js";
import { errorResponse, successResponse } from "../utils/response.js";
import {
    validateRegisterInput,
    validateLoginInput
} from "../validators/authValidator.js";

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
            return errorResponse(res, parsed.message, 400);
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
            return errorResponse(res, "Email already exists", 409);
        }

        const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

        const result = await pool.query(
            `INSERT INTO users
             (name, email, password, role)
             VALUES ($1, $2, $3, 'employee')
             RETURNING id, name, email, role, created_at`,
            [name, email, hashedPassword]
        );

        return successResponse(
            res,
            {
                message: "User registered successfully",
                user: result.rows[0]
            },
            201
        );

    } catch (error) {
        // Two requests with the same email at the same moment:
        // the database refuses the second one
        if (isDbErrorCode(error, "23505")) {
            return errorResponse(res, "Email already exists", 409);
        }

        logError(res, error);

        return errorResponse(res, "Failed to register user", 500);
    }
};

export const loginUser = async (req: Request, res: Response) => {
    try {
        const parsed = validateLoginInput(req.body);

        if (!parsed.ok) {
            return errorResponse(res, parsed.message, 400);
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
            return errorResponse(res, "Invalid email or password", 401);
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

        return successResponse(res, {
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

        return errorResponse(res, "Failed to login", 500);
    }
};
