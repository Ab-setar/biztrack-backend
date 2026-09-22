import bcrypt from "bcrypt";
import pool from "../db/database.js";

export const registerUser = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        // 1. Validate required fields
        if (!name || !email || !password) {
            return res.status(400).json({
                message: "Name, email and password are required"
            });
        }

        // 2. Check if email already exists
        const existingUser = await pool.query(
            `SELECT id
             FROM users
             WHERE email = $1`,
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                message: "Email already exists"
            });
        }

        // 3. Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // 4. Create user
        const result = await pool.query(
            `INSERT INTO users
             (name, email, password, role)
             VALUES ($1, $2, $3, $4)
             RETURNING id, name, email, role, created_at`,
            [
                name,
                email,
                hashedPassword,
                role || "employee"
            ]
        );

        // 5. Return user without password
        res.status(201).json({
            message: "User registered successfully",
            user: result.rows[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to register user"
        });
    }
};