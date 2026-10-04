import pool from "../db/database.js";

import {
    successResponse,
    errorResponse
} from "../utils/response.js";

export const createCustomer = async (req, res) => {
    try {
       
const { name, phone, email } = req.body;

const normalizedName =
    typeof name === "string" ? name.trim() : "";

const normalizedPhone =
    typeof phone === "string" ? phone.trim() : phone;

const normalizedEmail =
    typeof email === "string"
        ? email.trim().toLowerCase()
        : email;

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

if (
    !normalizedName ||
    (normalizedPhone !== undefined && !normalizedPhone) ||
    (normalizedEmail !== undefined && !normalizedEmail)
) {
    return errorResponse(
        res,
        "Invalid customer data",
        400
    );
}

if (
    normalizedEmail !== undefined &&
    !emailRegex.test(normalizedEmail)
) {
    return errorResponse(
        res,
        "Invalid email address",
        400
    );
}
        const result = await pool.query(
            `INSERT INTO customers (name, phone, email)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [normalizedName, normalizedPhone, normalizedEmail]
        );

        return successResponse(
            res,
            result.rows[0],
            201
        );

    } catch (error) {
        console.error(error);

        return errorResponse(
            res,  getProducts,
            "Failed to create customer",
            500
        );
    }
};


export const getCustomers = async (req, res) => {
    try {
        const page =
            req.query.page !== undefined
                ? Number(req.query.page)
                : 1;

        const limit =
            req.query.limit !== undefined
                ? Number(req.query.limit)
                : 10;

        const search =
            typeof req.query.search === "string"
                ? req.query.search.trim()
                : "";

        // Validate pagination
        if (
            !Number.isInteger(page) ||
            page < 1 ||
            !Number.isInteger(limit) ||
            limit < 1 ||
            limit > 100
        ) {
            return errorResponse(
                res,
                "Invalid pagination parameters",
                400
            );
        }

        const conditions = [];
        const values = [];

        // Customer search
        if (search) {
            values.push(`%${search}%`);

            conditions.push(
                `(name ILIKE $${values.length}
                OR phone ILIKE $${values.length}
                OR email ILIKE $${values.length})`
            );
        }

        const whereClause =
            conditions.length > 0
                ? `WHERE ${conditions.join(" AND ")}`
                : "";

        const offset = (page - 1) * limit;

        // Add pagination values
        values.push(limit);
        const limitParameter = values.length;

        values.push(offset);
        const offsetParameter = values.length;

        const result = await pool.query(
            `SELECT *
             FROM customers
             ${whereClause}
             ORDER BY id DESC
             LIMIT $${limitParameter}
             OFFSET $${offsetParameter}`,
            values
        );

        // Count filtered customers
        const countResult = await pool.query(
            `SELECT COUNT(*) AS total
             FROM customers
             ${whereClause}`,
            values.slice(0, -2)
        );

        const total = Number(
            countResult.rows[0].total
        );

        const totalPages = Math.ceil(
            total / limit
        );

        return successResponse(
            res,
            {
                customers: result.rows,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages,
                    count: result.rows.length
                }
            }
        );

    } catch (error) {
        console.error(error);

        return errorResponse(
            res,
            "Failed to get customers",
            500
        );
    }
};


export const getCustomerById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT * FROM customers
             WHERE id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return errorResponse(
                res,
                "Customer not found",
                404
            );
        }

        return successResponse(
            res,
            result.rows[0]
        );

    } catch (error) {
        console.error(error);

        return errorResponse(
            res,
            "Failed to get customer",
            500
        );
    }
};


export const updateCustomer = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, phone, email } = req.body;

const normalizedName =
    typeof name === "string" ? name.trim() : "";

const normalizedPhone =
    typeof phone === "string" ? phone.trim() : phone;

const normalizedEmail =
    typeof email === "string"
        ? email.trim().toLowerCase()
        : email;

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

if (
    !normalizedName ||
    (normalizedPhone !== undefined && !normalizedPhone) ||
    (normalizedEmail !== undefined && !normalizedEmail)
) {
    return errorResponse(
        res,
        "Invalid customer data",
        400
    );
}

if (
    normalizedEmail !== undefined &&
    !emailRegex.test(normalizedEmail)
) {
    return errorResponse(
        res,
        "Invalid email address",
        400
    );
}

        const result = await pool.query(
            `UPDATE customers
             SET name = $1,
                 phone = $2,
                 email = $3
             WHERE id = $4
             RETURNING *`,
            [normalizedName, normalizedPhone, normalizedEmail, id]
        );

        if (result.rows.length === 0) {
            return errorResponse(
                res,
                "Customer not found",
                404
            );
        }

        return successResponse(
            res,
            result.rows[0]
        );

    } catch (error) {
        console.error(error);

        return errorResponse(
            res,
            "Failed to update customer",
            500
        );
    }
};


export const deleteCustomer = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `DELETE FROM customers
             WHERE id = $1
             RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            return errorResponse(
                res,
                "Customer not found",
                404
            );
        }

        return successResponse(
            res,
            {
                message: "Customer deleted successfully",
                customer: result.rows[0]
            }
        );

    } catch (error) {
        console.error(error);

        return errorResponse(
            res,
            "Failed to delete customer",
            500
        );
    }
};
