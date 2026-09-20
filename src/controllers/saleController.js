import pool from "../db/database.js";

export const createSale = async (req, res) => {
    const client = await pool.connect();

    try {
        const { customer_id, items } = req.body;

        // 1. Validate request
        if (!customer_id || !items || items.length === 0) {
            return res.status(400).json({
                message: "Customer and sale items are required"
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
             (customer_id, total_amount)
             VALUES ($1, $2)
             RETURNING *`,
            [customer_id, totalAmount]
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