import express from "express";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { validateIdParam } from "../middleware/validateIdParam.js";
import {
    createCustomer,
    getCustomers,
    getCustomerById,
    updateCustomer,
    deleteCustomer
} from "../controllers/customerController.js";

const router = express.Router();

router.post(
    "/",
    authenticateToken,
    createCustomer
);

router.get(
    "/",
    authenticateToken,
    getCustomers
);

router.get<{ id: string }>(
    "/:id",
    authenticateToken,
    validateIdParam,
    getCustomerById
);

router.put<{ id: string }>(
    "/:id",
    authenticateToken,
    validateIdParam,
    updateCustomer
);

router.delete<{ id: string }>(
    "/:id",
    authenticateToken,
    authorizeRoles("owner"),
    validateIdParam,
    deleteCustomer
);

export default router;