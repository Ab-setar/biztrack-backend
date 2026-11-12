import { config } from "../config.js";
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { isUserRole } from "../constants/roles.js";

export const authenticateToken = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                message: "Authentication required"
            });
        }

        const parts = authHeader.split(" ");

        if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]) {
            return res.status(401).json({
                message: "Invalid authorization format"
            });
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
            return res.status(401).json({
                message: "Invalid token"
            });
        }

        req.user = {
            userId: decoded.userId,
            role: decoded.role
        };

        next();

    } catch (error) {
        return res.status(401).json({
            message: "Invalid or expired token"
        });
    }
};
