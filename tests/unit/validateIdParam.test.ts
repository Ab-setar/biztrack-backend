import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";
import { validateIdParam } from "../../src/middleware/validateIdParam.js";

// A tiny fake response and next function that record how they were used.
// No server and no database are needed.
const callMiddleware = (id: string) => {
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const next = vi.fn();

    validateIdParam(
        { params: { id } } as unknown as Request<{ id: string }>,
        { status } as unknown as Response,
        next
    );

    return { status, json, next };
};

describe("validateIdParam", () => {
    it.each(["1", "42", "2147483647"])("lets the id %j through", (id) => {
        const { status, next } = callMiddleware(id);

        expect(next).toHaveBeenCalledTimes(1);
        expect(status).not.toHaveBeenCalled();
    });

    it.each([
        "0",
        "-5",
        "1.5",
        "abc",
        "1e3",
        " 12 ",
        "",
        "0x10",
        "2147483648",
        "99999999999",
        "12abc"
    ])("answers 400 for the id %j", (id) => {
        const { status, json, next } = callMiddleware(id);

        expect(status).toHaveBeenCalledWith(400);
        expect(json).toHaveBeenCalledWith({
            success: false,
            message: "Invalid id"
        });
        expect(next).not.toHaveBeenCalled();
    });
});
