import pool from "../db/database.js";


export const createSale = async (req, res) => {
    const client = await pool.connect();

    try {
        const { customer_id, items } = req.body;

        // 1. Validate request
     if (
    !Number.isInteger(Number(customer_id)) ||
    Number(customer_id) <= 0 ||
    !Array.isArray(items) ||
    items.length === 0
) {
    return res.status(400).json({
        message: "Invalid customer or sale items"
    });
}
     //  Check for duplicate products
        const productIds = items.map(item => Number(item.product_id));

        const uniqueProductIds = new Set(productIds);

        if (uniqueProductIds.size !== productIds.length) {
            return res.status(400).json({
                message: "A product cannot appear more than once in a sale"
            });
        }

        // Start transaction
        await client.query("BEGIN");

        // 2. Check customer
        const customerResult = await client.query(
            `SELECT * FROM customers
             WHERE id = $1`,
            [customer_id]
        );

        if (customerResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                message: "Customer not found"
            });
        }

        let totalAmount = 0;
        const products = [];

        // 3. Check every product
        for (const item of items) {

            const { product_id, quantity } = item;

            if (!product_id || !quantity || quantity <= 0) {
                await client.query("ROLLBACK");

                return res.status(400).json({
                    message: "Invalid product or quantity"
                });
            }

            const productResult = await client.query(
                `SELECT *
                 FROM products
                 WHERE id = $1
                 FOR UPDATE`,
                [product_id]
            );

            if (productResult.rows.length === 0) {
                await client.query("ROLLBACK");

                return res.status(404).json({
                    message: `Product ${product_id} not found`
                });
            }

            const product = productResult.rows[0];

            // 4. Check stock
            if (product.stock_quantity < quantity) {
                await client.query("ROLLBACK");

                return res.status(400).json({
                    message: `Insufficient stock for ${product.name}`,
                    available: product.stock_quantity,
                    requested: quantity
                });
            }

            // 5. Calculate item total
            const itemTotal = Number(product.price) * quantity;

            totalAmount += itemTotal;

            products.push({
                product_id,
                quantity,
                unit_price: product.price
            });
        }

        // 6. Create sale
      const saleResult = await client.query(
    `INSERT INTO sales
     (customer_id, user_id, total_amount)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [
        customer_id,
        req.user.userId,
        totalAmount
    ]
);

        const sale = saleResult.rows[0];

        // 7. Create sale items + decrease stock
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

        // 8. Everything succeeded
        await client.query("COMMIT");

        res.status(201).json({
            message: "Sale created successfully",
            sale
        });

    } catch (error) {

        await client.query("ROLLBACK");

        console.error(error);

        res.status(500).json({
            message: "Failed to create sale"
        });

    } finally {

        client.release();
    }
};
export const getSales = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                sales.id,
                customers.name AS customer_name,
                sales.total_amount,
                sales.created_at
             FROM sales
             JOIN customers
                ON sales.customer_id = customers.id
             ORDER BY sales.created_at DESC`
        );

        res.status(200).json(result.rows);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to get sales"
        });
    }

};
export const getSaleById = async (req, res) => {
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
            return res.status(404).json({
                message: "Sale not found"
            });
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

        res.status(200).json({
            ...saleResult.rows[0],
            items: itemsResult.rows
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to get sale"
        });
    }
};