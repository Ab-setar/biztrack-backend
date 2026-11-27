import { describe, it, expect } from "vitest";
import { validateCustomerInput } from "../../src/validators/customerValidator.js";

const INVALID = { ok: false, message: "Invalid customer data" };

const email = (length: number) =>
    "e".repeat(length - "@example.com".length) + "@example.com";

describe("validateCustomerInput", () => {
    it("accepts a name alone and stores the optional fields as null", () => {
        expect(validateCustomerInput({ name: "  Abebe  " })).toEqual({
            ok: true,
            value: { name: "Abebe", phone: null, email: null }
        });
    });

    it("cleans the phone and the email", () => {
        expect(
            validateCustomerInput({
                name: "A",
                phone: "  0911223344 ",
                email: "  A@Example.COM "
            })
        ).toEqual({
            ok: true,
            value: { name: "A", phone: "0911223344", email: "a@example.com" }
        });
    });

    it("rejects a missing or blank name and values that are not text", () => {
        const bad = [
            undefined,
            null,
            "text",
            {},
            { name: "   " },
            { name: 5 },
            { name: "A", phone: "   " },
            { name: "A", phone: "" },
            { name: "A", phone: null },
            { name: "A", phone: 911223344 },
            { name: "A", email: "   " },
            { name: "A", email: null },
            { name: "A", email: 5 }
        ];

        for (const body of bad) {
            expect(validateCustomerInput(body)).toEqual(INVALID);
        }
    });

    it("rejects an invalid email address", () => {
        for (const value of ["not-an-email", "a@b", "a b@example.com", "@example.com"]) {
            expect(validateCustomerInput({ name: "A", email: value })).toEqual({
                ok: false,
                message: "Invalid email address"
            });
        }
    });

    it("applies the database length limits", () => {
        expect(
            validateCustomerInput({
                name: "n".repeat(100),
                phone: "0".repeat(20),
                email: email(100)
            }).ok
        ).toBe(true);

        expect(validateCustomerInput({ name: "n".repeat(101) })).toEqual({
            ok: false,
            message: "Name must be 100 characters or fewer"
        });

        expect(
            validateCustomerInput({ name: "A", phone: "0".repeat(21) })
        ).toEqual({
            ok: false,
            message: "Phone must be 20 characters or fewer"
        });

        expect(
            validateCustomerInput({ name: "A", email: email(101) })
        ).toEqual({
            ok: false,
            message: "Email must be 100 characters or fewer"
        });
    });
});
