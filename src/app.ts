import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import cors from "cors";

import productRoutes from "./routes/productRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import saleRoutes from "./routes/saleRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import { errorHandler } from "./middleware/errorMiddleware.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { config } from "./config.js";
import { docsRouter } from "./docs/docsRouter.js";

const app = express();

app.use(requestLogger);

app.use(helmet());
// Only the listed websites may read API responses in a browser.
// An empty list switches CORS off completely.
app.use(
    cors({
        origin: config.corsOrigins.length > 0 ? config.corsOrigins : false
    })
);
app.use(express.json({ limit: "100kb" }));

if (config.docsEnabled) {
    app.use("/api-docs", docsRouter);
}

app.get("/health", (_req, res) => {
    res.status(200).json({
        success: true,
        message: "BizTrack API is healthy"
    });
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many login attempts. Please try again later."
    }
});

const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many registration attempts. Please try again later."
    }
});

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    // The test suite sends many requests from one address
    skip: () => config.nodeEnv === "test",
    message: {
        success: false,
        message: "Too many requests. Please try again later."
    }
});

app.use("/api", apiLimiter);

app.use("/api/products", productRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/register", registerLimiter);
app.use("/api/auth", authRoutes);

app.use(errorHandler);

export default app;
