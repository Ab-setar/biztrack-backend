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