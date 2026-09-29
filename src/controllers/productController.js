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
        const result = await pool.query(
            `SELECT * FROM products`
        );

        return successResponse(
            res,
            result.rows
        );

    } catch (error) {
        next(error);
    }
};


export const getProductById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT * FROM products
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