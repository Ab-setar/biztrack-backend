import { Request, Response, NextFunction } from "express";

const hasErrorCode = (
    error: unknown
): error is { code: string } => {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof (error as { code: unknown }).code === "string"
    );
};

export const errorHandler = (
    error: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction
) => {
    console.error(error);

    if (hasErrorCode(error) && error.code === "23503") {
        return res.status(409).json({
            success: false,
            message: "Product cannot be deleted because it is used in existing sales"
        });
    }

    res.status(500).json({
        success: false,
        message: "Internal server error"
    });
};
