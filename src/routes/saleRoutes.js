import express from "express";

import {
    createSale,
    getSales,
    getSaleById
} from "../controllers/saleController.js";

import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", authenticateToken, createSale);

router.get("/", getSales);

router.get("/:id", getSaleById);

export default router;