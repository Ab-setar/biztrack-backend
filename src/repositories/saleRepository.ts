import type { PoolClient } from "pg";

export type LockedProduct = {
    id: number;
    name: string;
    price: string;
    stock_quantity: number;
};

export type SaleRow = {
    id: number;
    customer_id: number | null;
    user_id: number | null;
    total_amount: string;
    created_at: Date;
};

export const findCustomerById = async (
    client: PoolClient,
    customerId: number
): Promise<{ id: number } | undefined> => {
    const result = await client.query<{ id: number }>(
        `SELECT id
         FROM customers
         WHERE id = $1`,
        [customerId]
    );

    return result.rows[0];
};

// FOR UPDATE locks the row until the transaction ends
export const lockProductById = async (
    client: PoolClient,
    productId: number
): Promise<LockedProduct | undefined> => {
    const result = await client.query<LockedProduct>(
        `SELECT id, name, price, stock_quantity
         FROM products
         WHERE id = $1
         FOR UPDATE`,
        [productId]
    );

    return result.rows[0];
};

export const insertSale = async (
    client: PoolClient,
    customerId: number,
    userId: number | undefined,
    totalAmount: number
): Promise<SaleRow> => {
    const result = await client.query<SaleRow>(
        `INSERT INTO sales
         (customer_id, user_id, total_amount)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [customerId, userId ?? null, totalAmount]
    );

    return result.rows[0];
};

export const insertSaleItem = async (
    client: PoolClient,
    saleId: number,
    productId: number,
    quantity: number,
    unitPrice: string
): Promise<void> => {
    await client.query(
        `INSERT INTO sale_items
         (sale_id, product_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4)`,
        [saleId, productId, quantity, unitPrice]
    );
};

export const decreaseProductStock = async (
    client: PoolClient,
    productId: number,
    quantity: number
): Promise<void> => {
    await client.query(
        `UPDATE products
         SET stock_quantity = stock_quantity - $1
         WHERE id = $2`,
        [quantity, productId]
    );
};
