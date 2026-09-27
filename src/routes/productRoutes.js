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

const router = express.Router();

router.get(
    "/",
    authenticateToken,
    getProducts
);

router.get(
    "/:id",
    authenticateToken,
    getProductById
);

router.post(
    "/",
    authenticateToken,
    createProduct
);

router.put(
    "/:id",
    authenticateToken,
    updateProduct
);

router.delete(
    "/:id",
    authenticateToken,
    authorizeRoles("owner"),
    deleteProduct
);

export default router;