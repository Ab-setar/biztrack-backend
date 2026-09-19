import pool from "../db/database.js";

export const createCustomer = async (req, res) => {
    try {
        const { name, phone, email } = req.body;

        if (!name) {
            return res.status(400).json({
                message: "Customer name is required"
            });
        }

        const result = await pool.query(
            `INSERT INTO customers (name, phone, email)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [name, phone, email]
        );

        res.status(201).json(result.rows[0]);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to create customer"
        });
    }
};


export const getCustomers = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM customers`
        );

        res.status(200).json(result.rows);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to get customers"
        });
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
            return res.status(404).json({
                message: "Customer not found"
            });
        }

        res.status(200).json(result.rows[0]);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to get customer"
        });
    }
};


export const updateCustomer = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, phone, email } = req.body;

        if (!name) {
            return res.status(400).json({
                message: "Customer name is required"
            });
        }

        const result = await pool.query(
            `UPDATE customers
             SET name = $1,
                 phone = $2,
                 email = $3
             WHERE id = $4
             RETURNING *`,
            [name, phone, email, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Customer not found"
            });
        }

        res.status(200).json(result.rows[0]);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to update customer"
        });
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
            return res.status(404).json({
                message: "Customer not found"
            });
        }

        res.status(200).json({
            message: "Customer deleted successfully",
            customer: result.rows[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to delete customer"
        });
    }
};