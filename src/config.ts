import dotenv from "dotenv";

dotenv.config({ quiet: true });

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

const problems: string[] = [];

const readOptional = (name: string): string | undefined => {
    const value = process.env[name]?.trim();
    return value ? value : undefined;
};

const readRequired = (name: string): string => {
    const value = readOptional(name);

    if (value === undefined) {
        problems.push(`${name} is required`);
        return "";
    }

    return value;
};

const readString = (name: string, fallback: string): string =>
    readOptional(name) ?? fallback;

const readPort = (name: string, fallback: number): number => {
    const raw = readOptional(name);

    if (raw === undefined) {
        return fallback;
    }

    const value = Number(raw);

    if (!Number.isInteger(value) || value < 1 || value > 65535) {
        problems.push(`${name} must be a whole number between 1 and 65535`);
        return fallback;
    }

    return value;
};

const readChoice = <T extends string>(
    name: string,
    allowed: readonly T[],
    fallback: T
): T => {
    const raw = readOptional(name);

    if (raw === undefined) {
        return fallback;
    }

    if ((allowed as readonly string[]).includes(raw)) {
        return raw as T;
    }

    problems.push(`${name} must be one of: ${allowed.join(", ")}`);
    return fallback;
};

const nodeEnv = readChoice("NODE_ENV", NODE_ENVS, "development");
const logLevel = readChoice("LOG_LEVEL", LOG_LEVELS, "info");
const port = readPort("PORT", 5000);

const jwtSecret = readRequired("JWT_SECRET");

if (jwtSecret !== "" && nodeEnv === "production" && jwtSecret.length < 32) {
    problems.push("JWT_SECRET must be at least 32 characters in production");
}

const db = {
    host: readString("DB_HOST", "localhost"),
    port: readPort("DB_PORT", 5432),
    name: readString("DB_NAME", "biztrack"),
    user: readString("DB_USER", "postgres"),
    password: readRequired("DB_PASSWORD")
};

// Fail fast: refuse to start with a broken configuration
if (problems.length > 0) {
    throw new Error(
        `Invalid environment configuration:\n - ${problems.join("\n - ")}`
    );
}

export const config = {
    nodeEnv,
    logLevel,
    port,
    jwtSecret,
    db
} as const;
