import pool from "../db/database.js";

export const createProduct = async (req, res) => {
  try {
    const { name, price, stock_quantity } = req.body;

    if (!name || price < 0 || stock_quantity < 0) {
      return res.status(400).json({
        message: "Invalid product data",
      });
    }

    const result = await pool.query(
      `INSERT INTO products (name, price, stock_quantity)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, price, stock_quantity]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to create product",
    });
  }
};
export const getProducts = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM products`
        );

        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to get products"
        });
    }
};
export const getProductById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT * FROM products
             WHERE id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        res.status(200).json(result.rows[0]);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to get product"
        });
    }
};
export const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;

        const { name, price, stock_quantity } = req.body;

        if (!name || price < 0 || stock_quantity < 0) {
            return res.status(400).json({
                message: "Invalid product data"
            });
        }

        const result = await pool.query(
            `UPDATE products
             SET name = $1,
                 price = $2,
                 stock_quantity = $3
             WHERE id = $4
             RETURNING *`,
            [name, price, stock_quantity, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        res.status(200).json(result.rows[0]);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to update product"
        });
    }
};
export const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `DELETE FROM products
             WHERE id = $1
             RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        res.status(200).json({
            message: "Product deleted successfully",
            product: result.rows[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to delete product"
        });
    }
};

