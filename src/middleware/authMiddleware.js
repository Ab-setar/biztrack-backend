import jwt from "jsonwebtoken";

export const authenticateToken = (req, res, next) => {
    try {
        // 1. Get Authorization header
        const authHeader = req.headers.authorization;

        // 2. Check if header exists
        if (!authHeader) {
            return res.status(401).json({
                message: "Authentication required"
            });
        }

        // 3. Check Bearer format
        const parts = authHeader.split(" ");

        if (parts.length !== 2 || parts[0] !== "Bearer") {
            return res.status(401).json({
                message: "Invalid authorization format"
            });
        }

        // 4. Get token
        const token = parts[1];

        // 5. Verify token
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        // 6. Store user information in request
        req.user = decoded;

        // 7. Continue to controller
        next();

    } catch (error) {
        return res.status(401).json({
            message: "Invalid or expired token"
        });
    }
};