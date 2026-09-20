import express from "express";

import {
    createSale,
    getSales,
    getSaleById
} from "../controllers/saleController.js";

const router = express.Router();

router.post("/", createSale);
router.get("/", getSales);
router.get("/:id", getSaleById);

export default router;