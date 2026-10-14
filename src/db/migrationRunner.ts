
import pool from "./database.js";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);

// Works from both src/db and dist/db.
const projectRoot = path.resolve(currentDirectory, "../..");
const migrationsDirectory = path.join(projectRoot, "migrations");

async function createMigrationTable(): Promise<void> {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id SERIAL PRIMARY KEY,
            filename VARCHAR(255) UNIQUE NOT NULL,
            applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

async function runMigrations(): Promise<void> {
    await createMigrationTable();

    const files = (await readdir(migrationsDirectory))
        .filter((file) => /^\d+_.+\.sql$/.test(file))
        .sort();

    for (const filename of files) {
        const existing = await pool.query(
            `SELECT id FROM schema_migrations WHERE filename = $1`,
            [filename]
        );

        if (existing.rows.length > 0) {
            console.log(`Skipping applied migration: ${filename}`);
            continue;
        }

        const sql = await readFile(
            path.join(migrationsDirectory, filename),
            "utf8"
        );

        const client = await pool.connect();

        try {
            await client.query("BEGIN");
            await client.query(sql);
            await client.query(
                `INSERT INTO schema_migrations (filename) VALUES ($1)`,
                [filename]
            );
            await client.query("COMMIT");

            console.log(`Applied migration: ${filename}`);
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    }

    console.log("Migration process completed.");
}

runMigrations()
    .catch((error: unknown) => {
        console.error("Migration failed:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
