import pool from "../db/database.js";

import { successResponse, errorResponse } from "../utils/response.js";



export const createProduct = async (req, res, next) => {
    try {
      const { name, price, stock_quantity } = req.body;

const normalizedName =
    typeof name === "string" ? name.trim() : "";

const normalizedPrice =
    typeof price === "number" ? price : NaN;

const normalizedStockQuantity =
    typeof stock_quantity === "number"
        ? stock_quantity
        : NaN;

if (
    !normalizedName ||
    !Number.isFinite(normalizedPrice) ||
    normalizedPrice < 0 ||
    !Number.isInteger(normalizedStockQuantity) ||
    normalizedStockQuantity < 0
) {
    return errorResponse(
        res,
        "Invalid product data",
        400
    );
}

        const result = await pool.query(
            `INSERT INTO products (name, price, stock_quantity)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [normalizedName, normalizedPrice, normalizedStockQuantity]
        );

        return successResponse(
            res,
            result.rows[0],
            201
        );

    } catch (error) {
        next(error);
    }
};

export const getProducts = async (req, res, next) => {

    try {

        // Pagination
        const page =
            req.query.page !== undefined
                ? Number(req.query.page)
                : 1;

        const limit =
            req.query.limit !== undefined
                ? Number(req.query.limit)
                : 10;

        // Search
        const search =
            typeof req.query.search === "string"
                ? req.query.search.trim()
                : "";

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

        const offset = (page - 1) * limit;

        const searchPattern = `%${search}%`;

        // Get products
        const result = await pool.query(
            `SELECT *
             FROM products
             WHERE name ILIKE $1
             ORDER BY id DESC
             LIMIT $2 OFFSET $3`,
            [
                searchPattern,
                limit,
                offset
            ]
        );

        // Get total matching products
        const countResult = await pool.query(
            `SELECT COUNT(*) AS total
             FROM products
             WHERE name ILIKE $1`,
            [searchPattern]
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
                products: result.rows,

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

        next(error);

    }
};

export const getProductById = async(req, res, next) => {


try {


const { id } = req.params;
const result = await pool.query(


       ` SELECT FROM products

         WHERE id = $1`,

        [id]

    );

    if (result.rows.length === 0) {

        return errorResponse(

            res,

            "Product not found",

            404

        );

    }

    return successResponse(

        res,

        result.rows[0]

    );

} catch (error) {

    next(error);

}


};

export const updateProduct = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, price, stock_quantity } = req.body;

       const normalizedName =
    typeof name === "string" ? name.trim() : "";

const normalizedPrice =
    typeof price === "number" ? price : NaN;

const normalizedStockQuantity =
    typeof stock_quantity === "number"
        ? stock_quantity
        : NaN;

if (
    !normalizedName ||
    !Number.isFinite(normalizedPrice) ||
    normalizedPrice < 0 ||
    !Number.isInteger(normalizedStockQuantity) ||
    normalizedStockQuantity < 0
) {
    return errorResponse(
        res,
        "Invalid product data",
        400
    );
}

        const result = await pool.query(
            `UPDATE products
             SET name = $1,
                 price = $2,
                 stock_quantity = $3
             WHERE id = $4
             RETURNING *`,
            [normalizedName, normalizedPrice, normalizedStockQuantity, id]
        );

        if (result.rows.length === 0) {
            return errorResponse(
                res,
                "Product not found",
                404
            );
        }

        return successResponse(
            res,
            result.rows[0]
        );

    } catch (error) {
        next(error);
    }
};


export const deleteProduct = async (req, res, next) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `DELETE FROM products
             WHERE id = $1
             RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            return errorResponse(
                res,
                "Product not found",
                404
            );
        }

        return successResponse(
            res,
            {
                message: "Product deleted successfully",
                product: result.rows[0]
            }
        );

    } catch (error) {
        next(error);
    }
};