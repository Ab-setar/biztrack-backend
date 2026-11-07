import { createEnvReader } from "./envReader.js";
import { dbConfig } from "./dbConfig.js";

const NODE_ENVS = ["development", "test", "production"] as const;
const LOG_LEVELS = [
    "fatal",
    "error",
    "warn",
    "info",
    "debug",
    "trace",
    "silent"
] as const;

const env = createEnvReader();

const nodeEnv = env.choice("NODE_ENV", NODE_ENVS, "development");
const logLevel = env.choice("LOG_LEVEL", LOG_LEVELS, "info");
const port = env.port("PORT", 5000);
const jwtSecret = env.required("JWT_SECRET");

if (jwtSecret !== "" && nodeEnv === "production" && jwtSecret.length < 32) {
    env.addProblem("JWT_SECRET must be at least 32 characters in production");
}

env.assertValid();

export const config = {
    nodeEnv,
    logLevel,
    port,
    jwtSecret,
    db: dbConfig
} as const;
