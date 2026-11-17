import { config } from "../config.js";
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { isUserRole } from "../constants/roles.js";
import { errorResponse } from "../utils/response.js";

export const authenticateToken = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return errorResponse(res, "Authentication required", 401);
        }

        const parts = authHeader.split(" ");

        if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]) {
            return errorResponse(res, "Invalid authorization format", 401);
        }

        const decoded = jwt.verify(
            parts[1],
            config.jwtSecret,
            { algorithms: ["HS256"] }
        );

        if (
            typeof decoded === "string" ||
            typeof decoded.userId !== "number" ||
            !Number.isInteger(decoded.userId) ||
            decoded.userId <= 0 ||
            !isUserRole(decoded.role)
        ) {
            return errorResponse(res, "Invalid token", 401);
        }

        req.user = {
            userId: decoded.userId,
            role: decoded.role
        };

        next();

    } catch (error) {
        return errorResponse(res, "Invalid or expired token", 401);
    }
};
