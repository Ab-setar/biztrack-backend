export const errorHandler = (error, req, res, next) => {
    console.error(error);

    if (error.code === "23503") {
        return res.status(409).json({
            success: false,
            message: "Product cannot be deleted because it is used in existing sales"
        });
    }

    res.status(500).json({
        success: false,
        message: "Internal server error"
    });
};