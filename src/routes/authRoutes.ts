import express from "express";

import {
    registerUser,
    loginUser
} from "../controllers/authController.js";

import { authenticateToken } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.post("/login", loginUser);

// Only an owner can create accounts for employees
router.post(
    "/register",
    authenticateToken,
    authorizeRoles("owner"),
    registerUser
);

export default router;
