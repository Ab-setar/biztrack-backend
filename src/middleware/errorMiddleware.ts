import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError.js";
import { logError } from "../utils/logger.js";

export const errorHandler = (
    error: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction
) => {
    if (error instanceof AppError) {
        return res.status(error.statusCode).json({
            success: false,
            message: error.message
        });
    }

    logError(res, error, "Unhandled error");

    res.status(500).json({
        success: false,
        message: "Internal server error"
    });
};
