import express from "express";

import {
    createProduct,
    getProducts,
    getProductById,
    updateProduct,
    deleteProduct
} from "../controllers/productController.js";

import { authenticateToken } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { validateIdParam } from "../middleware/validateIdParam.js";

const router = express.Router();

router.get("/", authenticateToken, getProducts);

router.get<{ id: string }>(
    "/:id",
    authenticateToken,
    validateIdParam,
    getProductById
);

router.post(
    "/",
    authenticateToken,
    createProduct
);

router.put<{ id: string }>(
    "/:id",
    authenticateToken,
    validateIdParam,
    updateProduct
);

router.delete<{ id: string }>(
    "/:id",
    authenticateToken,
    authorizeRoles("owner"),
    validateIdParam,
    deleteProduct
);

export default router;
