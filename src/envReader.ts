import dotenv from "dotenv";

dotenv.config({ quiet: true });

// Reads environment variables and collects every problem found,
// so the app can refuse to start with one clear message
export const createEnvReader = () => {
    const problems: string[] = [];

    const optional = (name: string): string | undefined => {
        const value = process.env[name]?.trim();
        return value ? value : undefined;
    };

    const required = (name: string): string => {
        const value = optional(name);

        if (value === undefined) {
            problems.push(`${name} is required`);
            return "";
        }

        return value;
    };

    const text = (name: string, fallback: string): string =>
        optional(name) ?? fallback;

    const port = (name: string, fallback: number): number => {
        const raw = optional(name);

        if (raw === undefined) {
            return fallback;
        }

        const value = Number(raw);

        if (!Number.isInteger(value) || value < 1 || value > 65535) {
            problems.push(
                `${name} must be a whole number between 1 and 65535`
            );
            return fallback;
        }

        return value;
    };

    const choice = <T extends string>(
        name: string,
        allowed: readonly T[],
        fallback: T
    ): T => {
        const raw = optional(name);

        if (raw === undefined) {
            return fallback;
        }

        if ((allowed as readonly string[]).includes(raw)) {
            return raw as T;
        }

        problems.push(`${name} must be one of: ${allowed.join(", ")}`);
        return fallback;
    };

    const flag = (name: string, fallback: boolean): boolean => {
        const raw = optional(name);

        if (raw === undefined) {
            return fallback;
        }

        if (raw === "true") {
            return true;
        }

        if (raw === "false") {
            return false;
        }

        problems.push(`${name} must be true or false`);
        return fallback;
    };

    const addProblem = (message: string): void => {
        problems.push(message);
    };

    // Fail fast: names only, never values
    const assertValid = (): void => {
        if (problems.length > 0) {
            throw new Error(
                `Invalid environment configuration:\n - ${problems.join("\n - ")}`
            );
        }
    };

    return {
        optional,
        required,
        text,
        port,
        choice,
        flag,
        addProblem,
        assertValid
    };
};
