import { createEnvReader } from "./envReader.js";

const env = createEnvReader();

export const dbConfig = {
    host: env.text("DB_HOST", "localhost"),
    port: env.port("DB_PORT", 5432),
    name: env.text("DB_NAME", "biztrack"),
    user: env.text("DB_USER", "postgres"),
    password: env.required("DB_PASSWORD")
} as const;

env.assertValid();
