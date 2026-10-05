import pool from "../db/database.js";
import { Product } from "../types/product.js";

const getProducts = async (): Promise<Product[]> => {
    const result = await pool.query<Product>(
        "SELECT * FROM products ORDER BY id DESC"
    );

    return result.rows;
};

const products = await getProducts();

console.log(products);

await pool.end();