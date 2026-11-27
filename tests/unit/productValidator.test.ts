import { describe, it, expect } from "vitest";
import { validateProductInput } from "../../src/validators/productValidator.js";

const INVALID = { ok: false, message: "Invalid product data" };
const valid = { name: "Laptop", price: 10, stock_quantity: 3 };

describe("validateProductInput", () => {
    it("accepts valid input and trims the name", () => {
        expect(validateProductInput({ ...valid, name: "  Laptop  " })).toEqual({
            ok: true,
            value: { ...valid, description: null }
        });
    });

    it("accepts the smallest and largest allowed values", () => {
        expect(
            validateProductInput({ name: "x", price: 0, stock_quantity: 0 }).ok
        ).toBe(true);

        expect(
            validateProductInput({
                name: "n".repeat(100),
                price: 99999999.99,
                stock_quantity: 2147483647
            }).ok
        ).toBe(true);

        expect(validateProductInput({ ...valid, price: 0.1 }).ok).toBe(true);
        expect(validateProductInput({ ...valid, price: 19.99 }).ok).toBe(true);
    });

    it("rejects missing, blank, wrong type and negative values", () => {
        const bad = [
            undefined,
            null,
            "text",
            {},
            { ...valid, name: "   " },
            { ...valid, name: 5 },
            { ...valid, price: "10" },
            { ...valid, price: null },
            { ...valid, price: NaN },
            { ...valid, price: Infinity },
            { ...valid, price: -0.01 },
            { ...valid, stock_quantity: 1.5 },
            { ...valid, stock_quantity: "3" },
            { ...valid, stock_quantity: -1 }
        ];

        for (const body of bad) {
            expect(validateProductInput(body)).toEqual(INVALID);
        }
    });

    it("rejects values that do not fit the database columns", () => {
        expect(
            validateProductInput({ ...valid, name: "n".repeat(101) })
        ).toEqual({
            ok: false,
            message: "Product name must be 100 characters or fewer"
        });

        expect(validateProductInput({ ...valid, price: 100000000 })).toEqual({
            ok: false,
            message: "Price must be 99999999.99 or less"
        });

        expect(
            validateProductInput({ ...valid, stock_quantity: 2147483648 })
        ).toEqual({
            ok: false,
            message: "Stock quantity must be 2147483647 or less"
        });
    });

    it("rejects more than 2 decimal places instead of rounding", () => {
        // 0.1 + 0.2 is 0.30000000000000004 in floating point
        for (const price of [19.999, 0.001, 0.1 + 0.2]) {
            expect(validateProductInput({ ...valid, price })).toEqual({
                ok: false,
                message: "Price can have at most 2 decimal places"
            });
        }
    });
});

describe("validateProductInput description", () => {
    it("is optional and stored as null when left out, null or blank", () => {
        for (const extra of [
            {},
            { description: null },
            { description: "" },
            { description: "   " }
        ]) {
            expect(validateProductInput({ ...valid, ...extra })).toEqual({
                ok: true,
                value: { ...valid, description: null }
            });
        }
    });

    it("trims the text and accepts the longest allowed", () => {
        expect(
            validateProductInput({ ...valid, description: "  Fast  " })
        ).toEqual({
            ok: true,
            value: { ...valid, description: "Fast" }
        });

        expect(
            validateProductInput({ ...valid, description: "d".repeat(1000) }).ok
        ).toBe(true);
    });

    it("rejects text that is too long and values that are not text", () => {
        expect(
            validateProductInput({ ...valid, description: "d".repeat(1001) })
        ).toEqual({
            ok: false,
            message: "Description must be 1000 characters or fewer"
        });

        for (const description of [5, true, ["x"], { a: 1 }]) {
            expect(validateProductInput({ ...valid, description })).toEqual(
                INVALID
            );
        }
    });
});
