import express from "express";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
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
router.get(
    "/:id",
    authenticateToken,
    getCustomerById
);
router.put(
    "/:id",
    authenticateToken,
    updateCustomer
);
router.delete(
    "/:id",
    authenticateToken,
    authorizeRoles("owner"),
    deleteCustomer
    );

export default router;