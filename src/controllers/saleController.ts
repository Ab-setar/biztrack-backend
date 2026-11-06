import { Request, Response, NextFunction } from "express";

import pool from "../db/database.js";
import * as saleService from "../services/saleService.js";

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
    res: Response,
    next: NextFunction
) => {
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
            (item) => item.product_id
        );

        if (new Set(productIds).size !== productIds.length) {
            return errorResponse(
                res,
                "A product cannot appear more than once in a sale",
                400
            );
        }

        // 5. Business rules and the transaction live in the service
        const sale = await saleService.createSale(
            customerId,
            req.user?.userId,
            normalizedItems
        );

        return successResponse(
            res,
            {
                message: "Sale created successfully",
                sale
            },
            201
        );
    } catch (error) {
        next(error);
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
