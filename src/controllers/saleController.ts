import { Request, Response } from "express";

import pool from "../db/database.js";

import {
    successResponse,
    errorResponse
} from "../utils/response.js";


interface SaleItemInput {
    product_id: unknown;
    quantity: unknown;
}

interface CreateSaleBody {
    customer_id: unknown;
    items: unknown;
}

interface SaleQuery {
    page?: string;
    limit?: string;
    customer_id?: string;
}

interface SaleParams {
    id: string;
}


export const createSale = async (
    req: Request<{}, {}, CreateSaleBody>,
    res: Response
) => {

    const client = await pool.connect();

    try {

        const { customer_id, items } = req.body;

        // 1. Normalize input
        const customerId = Number(customer_id);

        // 2. Validate customer and sale items
        if (
            !Number.isInteger(customerId) ||
            customerId <= 0 ||
            !Array.isArray(items) ||
            items.length === 0
        ) {
            return errorResponse(
                res,
                "Invalid customer or sale items",
                400
            );
        }

        // 3. Normalize and validate every sale item
        const normalizedItems = (items as SaleItemInput[]).map(
            (item) => ({
                product_id: Number(item.product_id),
                quantity: Number(item.quantity)
            })
        );

        for (const item of normalizedItems) {

            if (
                !Number.isInteger(item.product_id) ||
                item.product_id <= 0 ||
                !Number.isInteger(item.quantity) ||
                item.quantity <= 0
            ) {
                return errorResponse(
                    res,
                    "Invalid sale item data",
                    400
                );
            }
        }

        // 4. Check for duplicate products
        const productIds = normalizedItems.map(
            item => item.product_id
        );

        const uniqueProductIds = new Set(productIds);

        if (uniqueProductIds.size !== productIds.length) {
            return errorResponse(
                res,
                "A product cannot appear more than once in a sale",
                400
            );
        }

        // 5. Start transaction
        await client.query("BEGIN");

        // 6. Check customer
        const customerResult = await client.query(
            `SELECT *
             FROM customers
             WHERE id = $1`,
            [customerId]
        );

        if (customerResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return errorResponse(
                res,
                "Customer not found",
                404
            );
        }

        let totalAmount = 0;

        const products: {
            product_id: number;
            quantity: number;
            unit_price: number | string;
        }[] = [];

        // 7. Check every product
        for (const item of normalizedItems) {

            const { product_id, quantity } = item;

            const productResult = await client.query(
                `SELECT *
                 FROM products
                 WHERE id = $1
                 FOR UPDATE`,
                [product_id]
            );

            if (productResult.rows.length === 0) {
                await client.query("ROLLBACK");

                return errorResponse(
                    res,
                    `Product ${product_id} not found`,
                    404
                );
            }

            const product = productResult.rows[0];

            // 8. Check stock
            if (product.stock_quantity < quantity) {
                await client.query("ROLLBACK");

                return errorResponse(
                    res,
                    `Insufficient stock for ${product.name}`,
                    400
                );
            }

            // 9. Calculate item total
            const itemTotal =
                Number(product.price) * quantity;

            totalAmount += itemTotal;

            products.push({
                product_id,
                quantity,
                unit_price: product.price
            });
        }

        // 10. Create sale
        const saleResult = await client.query(
            `INSERT INTO sales
             (customer_id, user_id, total_amount)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [
                customerId,
                req.user?.userId,
                totalAmount
            ]
        );

        const sale = saleResult.rows[0];

        // 11. Create sale items + decrease stock
        for (const product of products) {

            await client.query(
                `INSERT INTO sale_items
                 (sale_id, product_id, quantity, unit_price)
                 VALUES ($1, $2, $3, $4)`,
                [
                    sale.id,
                    product.product_id,
                    product.quantity,
                    product.unit_price
                ]
            );

            await client.query(
                `UPDATE products
                 SET stock_quantity = stock_quantity - $1
                 WHERE id = $2`,
                [
                    product.quantity,
                    product.product_id
                ]
            );
        }

        // 12. Everything succeeded
        await client.query("COMMIT");

        return successResponse(
            res,
            {
                message: "Sale created successfully",
                sale
            },
            201
        );

    } catch (error) {

        await client.query("ROLLBACK");

        console.error(error);

        return errorResponse(
            res,
            "Failed to create sale",
            500
        );

    } finally {

        client.release();

    }
};


export const getSales = async (
    req: Request<{}, {}, {}, SaleQuery>,
    res: Response
) => {
    try {

        const page =
            req.query.page !== undefined
                ? Number(req.query.page)
                : 1;

        const limit =
            req.query.limit !== undefined
                ? Number(req.query.limit)
                : 10;

        const customerIdRaw = req.query.customer_id;

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

        const conditions: string[] = [];
        const values: unknown[] = [];

        // Customer filter
        if (customerIdRaw !== undefined) {

            const customerId = Number(customerIdRaw);

            if (
                !Number.isInteger(customerId) ||
                customerId <= 0
            ) {
                return errorResponse(
                    res,
                    "Invalid customer_id",
                    400
                );
            }

            values.push(customerId);

            conditions.push(
                `sales.customer_id = $${values.length}`
            );
        }

        const whereClause =
            conditions.length > 0
                ? `WHERE ${conditions.join(" AND ")}`
                : "";

        const offset = (page - 1) * limit;

        // Pagination parameters
        values.push(limit);
        const limitParameter = values.length;

        values.push(offset);
        const offsetParameter = values.length;

        const result = await pool.query(
            `SELECT
                sales.id,
                customers.name AS customer_name,
                sales.total_amount,
                sales.created_at
             FROM sales
             JOIN customers
                ON sales.customer_id = customers.id
             ${whereClause}
             ORDER BY sales.created_at DESC
             LIMIT $${limitParameter}
             OFFSET $${offsetParameter}`,
            values
        );

        // Count filtered sales
        const countResult = await pool.query(
            `SELECT COUNT(*) AS total
             FROM sales
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
                sales: result.rows,
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
            "Failed to get sales",
            500
        );
    }
};


export const getSaleById = async (
    req: Request<SaleParams>,
    res: Response
) => {

    try {

        const { id } = req.params;

        const saleResult = await pool.query(
            `SELECT
                sales.id,
                customers.name AS customer_name,
                sales.total_amount,
                sales.created_at
             FROM sales
             JOIN customers
                ON sales.customer_id = customers.id
             WHERE sales.id = $1`,
            [id]
        );

        if (saleResult.rows.length === 0) {

            return errorResponse(
                res,
                "Sale not found",
                404
            );
        }

        const itemsResult = await pool.query(
            `SELECT
                products.name AS product_name,
                sale_items.quantity,
                sale_items.unit_price
             FROM sale_items
             JOIN products
                ON sale_items.product_id = products.id
             WHERE sale_items.sale_id = $1`,
            [id]
        );

        return successResponse(
            res,
            {
                ...saleResult.rows[0],
                items: itemsResult.rows
            }
        );

    } catch (error) {

        console.error(error);

        return errorResponse(
            res,
            "Failed to get sale",
            500
        );
    }
};