import { pino } from "pino";
import type { Response } from "express";

const isTest = process.env.NODE_ENV === "test";

export const logger = pino({
    level: isTest ? "silent" : (process.env.LOG_LEVEL ?? "info"),
    redact: {
        paths: [
            "req.headers.authorization",
            "req.headers.cookie",
            "password",
            "*.password",
            "token",
            "*.token"
        ],
        censor: "[REDACTED]"
    }
});

// Logs an error with its stack and the id of the current request
export const logError = (
    res: Response,
    error: unknown,
    message = "Request failed"
): void => {
    logger.error(
        { err: error, requestId: res.locals.requestId },
        message
    );
};
