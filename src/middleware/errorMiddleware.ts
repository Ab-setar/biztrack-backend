import { Request, Response, NextFunction } from "express";

export const errorHandler = (
    error: any,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    console.error(error);

    if (error.code === "23503") {
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
