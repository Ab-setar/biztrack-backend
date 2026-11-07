import { randomUUID } from "node:crypto";
import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";

export const requestLogger = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    // Health checks run constantly and would flood the logs
    if (req.path === "/health") {
        return next();
    }

    const requestId = randomUUID();
    const startedAt = process.hrtime.bigint();

    res.locals.requestId = requestId;
    res.setHeader("X-Request-Id", requestId);

    res.on("finish", () => {
        const durationMs =
            Number(process.hrtime.bigint() - startedAt) / 1_000_000;

        const level =
            res.statusCode >= 500
                ? "error"
                : res.statusCode >= 400
                    ? "warn"
                    : "info";

        // Only safe fields: never headers, bodies or the query string
        logger[level](
            {
                requestId,
                method: req.method,
                path: req.originalUrl.split("?")[0],
                statusCode: res.statusCode,
                durationMs: Math.round(durationMs),
                userId: req.user?.userId
            },
            "request completed"
        );
    });

    next();
};
