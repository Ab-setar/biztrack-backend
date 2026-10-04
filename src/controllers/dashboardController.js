import pool from "../db/database.js";
import { successResponse, errorResponse } from "../utils/response.js";

export const getDashboardStats = async (req, res) => {
    try {
        const productsResult = await pool.query(
            `SELECT COUNT(*) AS total
             FROM products`
        );

        const customersResult = await pool.query(
            `SELECT COUNT(*) AS total
             FROM customers`
        );

        const salesResult = await pool.query(
            `SELECT
                COUNT(*) AS total_sales,
                COALESCE(SUM(total_amount), 0) AS total_revenue
             FROM sales`
        );

        const lowStockCountResult = await pool.query(
            `SELECT COUNT(*) AS total
             FROM products
             WHERE stock_quantity <= 5`
        );

        // Get latest 5 sales
        const recentSalesResult = await pool.query(
            `SELECT
                sales.id,
                customers.name AS customer_name,
                sales.total_amount,
                sales.created_at
             FROM sales
             JOIN customers
                ON sales.customer_id = customers.id
             ORDER BY sales.created_at DESC
             LIMIT 5`
        );

        // Get low-stock products
        const lowStockProductsResult = await pool.query(
            `SELECT
                id,
                name,
                stock_quantity
             FROM products
             WHERE stock_quantity <= 5
             ORDER BY stock_quantity ASC
             LIMIT 10`
        );

        return successResponse(
            res,
            {
                totalProducts: Number(
                    productsResult.rows[0].total
                ),

                totalCustomers: Number(
                    customersResult.rows[0].total
                ),

                totalSales: Number(
                    salesResult.rows[0].total_sales
                ),

                totalRevenue:
                    salesResult.rows[0].total_revenue,

                lowStockProductsCount: Number(
                    lowStockCountResult.rows[0].total
                ),

                recentSales:
                    recentSalesResult.rows,

                lowStockProducts:
                    lowStockProductsResult.rows
            }
        );

    } catch (error) {
        console.error(error);

        return errorResponse(
            res,
            "Failed to get dashboard statistics",
            500
        );
    }
};