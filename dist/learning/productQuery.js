import pool from "../db/database.js";
const getProducts = async () => {
    const result = await pool.query("SELECT * FROM products ORDER BY id DESC");
    return result.rows;
};
const products = await getProducts();
console.log(products);
await pool.end();
