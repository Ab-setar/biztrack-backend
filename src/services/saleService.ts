import pool from "../db/database.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";
import * as saleRepository from "../repositories/saleRepository.js";

export type SaleItemInput = {
    product_id: number;
    quantity: number;
};

export const createSale = async (
    customerId: number,
    userId: number | undefined,
    items: SaleItemInput[]
): Promise<saleRepository.SaleRow> => {
    // Lock products in a consistent order to prevent deadlocks
    const sortedItems = [...items].sort(
        (a, b) => a.product_id - b.product_id
    );

    const client = await pool.connect();
    let rollbackFailed = false;

    try {
        await client.query("BEGIN");

        const customer = await saleRepository.findCustomerById(
            client,
            customerId
        );

        if (!customer) {
            throw new AppError("Customer not found", 404);
        }

        let totalAmount = 0;

        const lines: {
            product_id: number;
            quantity: number;
            unit_price: string;
        }[] = [];

        for (const item of sortedItems) {
            const product = await saleRepository.lockProductById(
                client,
                item.product_id
            );

            if (!product) {
                throw new AppError(
                    `Product ${item.product_id} not found`,
                    404
                );
            }

            if (product.stock_quantity < item.quantity) {
                throw new AppError(
                    `Insufficient stock for ${product.name}`,
                    400
                );
            }

            totalAmount += Number(product.price) * item.quantity;

            lines.push({
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: product.price
            });
        }

        const sale = await saleRepository.insertSale(
            client,
            customerId,
            userId,
            totalAmount
        );

        for (const line of lines) {
            await saleRepository.insertSaleItem(
                client,
                sale.id,
                line.product_id,
                line.quantity,
                line.unit_price
            );

            await saleRepository.decreaseProductStock(
                client,
                line.product_id,
                line.quantity
            );
        }

        await client.query("COMMIT");

        return sale;
    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            rollbackFailed = true;
            logger.error({ err: rollbackError }, "Rollback failed");
        }

        throw error;
    } finally {
        // Destroy the connection if rollback failed, so a broken
        // connection is never returned to the pool
        client.release(rollbackFailed);
    }
};
