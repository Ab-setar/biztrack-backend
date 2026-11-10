import { RequestHandler } from "express";
import { errorResponse } from "../utils/response.js";

// Largest value a PostgreSQL integer column can hold
const MAX_ID = 2_147_483_647;

// Put this after authentication, so only logged-in users see validation errors
export const validateIdParam: RequestHandler<{ id: string }> = (
    req,
    res,
    next
) => {
    const { id } = req.params;

    // Digits only: no sign, no decimal point, no spaces, no "1e3"
    const isWholeNumber = /^\d+$/.test(id);
    const value = Number(id);

    if (!isWholeNumber || value < 1 || value > MAX_ID) {
        return errorResponse(res, "Invalid id", 400);
    }

    next();
};
