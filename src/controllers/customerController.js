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
            res,
            "Failed to create customer",
            500
        );
    }
};


export const getCustomers = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM customers`
        );

        return successResponse(
            res,
            result.rows
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
