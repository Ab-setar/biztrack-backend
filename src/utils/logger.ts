import { pino } from "pino";
import type { Response } from "express";
import { config } from "../config.js";

export const logger = pino({
    level: config.nodeEnv === "test" ? "silent" : config.logLevel,
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
