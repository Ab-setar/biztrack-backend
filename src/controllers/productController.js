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

        const minPriceRaw = req.query.minPrice;
        const maxPriceRaw = req.query.maxPrice;
        const inStockRaw = req.query.inStock;

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

        // Search
        if (search) {
            values.push(`%${search}%`);

            conditions.push(
                `name ILIKE $${values.length}`
            );
        }

        // Minimum price
        let minPrice;

        if (minPriceRaw !== undefined) {
            minPrice = Number(minPriceRaw);

            if (
                !Number.isFinite(minPrice) ||
                minPrice < 0
            ) {
                return errorResponse(
                    res,
                    "Invalid minimum price",
                    400
                );
            }

            values.push(minPrice);

            conditions.push(
                `price >= $${values.length}`
            );
        }

        // Maximum price
        let maxPrice;

        if (maxPriceRaw !== undefined) {
            maxPrice = Number(maxPriceRaw);

            if (
                !Number.isFinite(maxPrice) ||
                maxPrice < 0
            ) {
                return errorResponse(
                    res,
                    "Invalid maximum price",
                    400
                );
            }

            values.push(maxPrice);

            conditions.push(
                `price <= $${values.length}`
            );
        }

        // Make sure minPrice is not greater than maxPrice
        if (
            minPrice !== undefined &&
            maxPrice !== undefined &&
            minPrice > maxPrice
        ) {
            return errorResponse(
                res,
                "Minimum price cannot be greater than maximum price",
                400
            );
        }

        // Stock filter
        if (inStockRaw !== undefined) {
            if (
                inStockRaw !== "true" &&
                inStockRaw !== "false"
            ) {
                return errorResponse(
                    res,
                    "Invalid inStock value. Use true or false",
                    400
                );
            }

            if (inStockRaw === "true") {
                conditions.push(
                    "stock_quantity > 0"
                );
            } else {
                conditions.push(
                    "stock_quantity = 0"
                );
            }
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
             FROM products
             ${whereClause}
             ORDER BY id DESC
             LIMIT $${limitParameter}
             OFFSET $${offsetParameter}`,
            values
        );

        // Count filtered products
        const countResult = await pool.query(
            `SELECT COUNT(*) AS total
             FROM products
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