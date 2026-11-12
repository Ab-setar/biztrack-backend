import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError.js";
import { logError } from "../utils/logger.js";

type HttpLikeError = {
    status?: unknown;
    statusCode?: unknown;
    type?: unknown;
};

// Errors from body-parser and similar packages carry an HTTP status.
// A 4xx status means the caller sent something wrong, not that we broke.
const getClientErrorStatus = (error: unknown): number | undefined => {
    if (typeof error !== "object" || error === null) {
        return undefined;
    }

    const { status, statusCode } = error as HttpLikeError;
    const value = typeof status === "number" ? status : statusCode;

    return typeof value === "number" && value >= 400 && value < 500
        ? value
        : undefined;
};

// Fixed messages: never send the library's own text to the client
const clientErrorMessage = (status: number, type: unknown): string => {
    if (type === "entity.parse.failed") {
        return "Invalid JSON in request body";
    }

    if (type === "entity.too.large" || status === 413) {
        return "Request body is too large";
    }

    return "Bad request";
};

export const errorHandler = (
    error: unknown,
    _req: Request,
    res: Response,
    next: NextFunction
) => {
    if (res.headersSent) {
        return next(error);
    }

    if (error instanceof AppError) {
        return res.status(error.statusCode).json({
            success: false,
            message: error.message
        });
    }

    const clientStatus = getClientErrorStatus(error);

    if (clientStatus !== undefined) {
        return res.status(clientStatus).json({
            success: false,
            message: clientErrorMessage(
                clientStatus,
                (error as HttpLikeError).type
            )
        });
    }

    logError(res, error, "Unhandled error");

    res.status(500).json({
        success: false,
        message: "Internal server error"
    });
};
