import { Request, Response, NextFunction } from "express";
import { errorResponse } from "../utils/response.js";

export const authorizeRoles = (...allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {

        if (!req.user) {
            return errorResponse(res, "Authentication required", 401);
        }

        if (!allowedRoles.includes(req.user.role as string)) {
            return errorResponse(
                res,
                "You do not have permission to perform this action",
                403
            );
        }

        next();
    };
};
