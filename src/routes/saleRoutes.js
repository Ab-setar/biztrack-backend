import express from "express";
import { authenticateToken } from "../middleware/authMiddleware.js";
import {
    createSale,
    getSales,
    getSaleById
} from "../controllers/saleController.js";



const router = express.Router();

router.get(
    "/",
    authenticateToken,
    getSales
);

router.get(
    "/:id",
    authenticateToken,
    getSaleById
);

router.post(
    "/",
    authenticateToken,
    createSale
);
export default router;