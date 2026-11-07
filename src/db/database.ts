import { Pool } from "pg";
import { dbConfig } from "../dbConfig.js";

const pool = new Pool({
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.name,
    user: dbConfig.user,
    password: dbConfig.password
});

export default pool;
