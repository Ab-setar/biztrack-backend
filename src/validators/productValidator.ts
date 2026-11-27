import { asRecord, type ValidationResult } from "./validationResult.js";

// name is varchar(100), price is numeric(10,2) and stock_quantity is integer
// in the products table. The description is free text in the database,
// and its limit is our own choice.
export const PRODUCT_LIMITS = {
    nameMaxLength: 100,
    descriptionMaxLength: 1000,
    priceMax: 99_999_999.99,
    stockMax: 2_147_483_647
} as const;

export type ProductInput = {
    name: string;
    price: number;
    stock_quantity: number;
    description: string | null;
};

export const validateProductInput = (
    body: unknown
): ValidationResult<ProductInput> => {
    const { name, price, stock_quantity, description } = asRecord(body);

    const cleanName = typeof name === "string" ? name.trim() : "";

    if (
        !cleanName ||
        typeof price !== "number" ||
        !Number.isFinite(price) ||
        price < 0 ||
        typeof stock_quantity !== "number" ||
        !Number.isInteger(stock_quantity) ||
        stock_quantity < 0 ||
        (description !== undefined &&
            description !== null &&
            typeof description !== "string")
    ) {
        return { ok: false, message: "Invalid product data" };
    }

    // Optional. Leave it out, or send null or a blank text, to store nothing.
    const cleanDescription =
        typeof description === "string" ? description.trim() || null : null;

    if (cleanName.length > PRODUCT_LIMITS.nameMaxLength) {
        return {
            ok: false,
            message: `Product name must be ${PRODUCT_LIMITS.nameMaxLength} characters or fewer`
        };
    }

    if (
        cleanDescription !== null &&
        cleanDescription.length > PRODUCT_LIMITS.descriptionMaxLength
    ) {
        return {
            ok: false,
            message: `Description must be ${PRODUCT_LIMITS.descriptionMaxLength} characters or fewer`
        };
    }

    if (price > PRODUCT_LIMITS.priceMax) {
        return {
            ok: false,
            message: `Price must be ${PRODUCT_LIMITS.priceMax.toFixed(2)} or less`
        };
    }

    // Money has 2 decimals. Reject 19.999 instead of silently rounding it.
    if (Math.round(price * 100) / 100 !== price) {
        return { ok: false, message: "Price can have at most 2 decimal places" };
    }

    if (stock_quantity > PRODUCT_LIMITS.stockMax) {
        return {
            ok: false,
            message: `Stock quantity must be ${PRODUCT_LIMITS.stockMax} or less`
        };
    }

    return {
        ok: true,
        value: {
            name: cleanName,
            price,
            stock_quantity,
            description: cleanDescription
        }
    };
};
