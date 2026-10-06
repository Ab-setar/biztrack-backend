import express from "express";

import {
    getDashboardStats
} from "../controllers/dashboardController.js";

import {
    authenticateToken
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.get(
    "/",
    authenticateToken,
    getDashboardStats
);

export default router;