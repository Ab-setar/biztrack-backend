import { describe, it, expect } from "vitest";
import {
    validateRegisterInput,
    validateLoginInput
} from "../../src/validators/authValidator.js";

const REQUIRED = "Name, email and password are required";

const valid = {
    name: "Abebe Kebede",
    email: "abebe@example.com",
    password: "long-enough-1"
};

describe("validateRegisterInput", () => {
    it("accepts valid input and cleans the name and email", () => {
        expect(
            validateRegisterInput({
                name: "  Abebe Kebede  ",
                email: "  Abebe.Kebede@Example.COM ",
                password: "long-enough-1"
            })
        ).toEqual({
            ok: true,
            value: {
                name: "Abebe Kebede",
                email: "abebe.kebede@example.com",
                password: "long-enough-1"
            }
        });
    });

    it("keeps spaces inside and around the password", () => {
        expect(
            validateRegisterInput({ ...valid, password: "  spaced pass  " })
        ).toEqual({
            ok: true,
            value: { ...valid, password: "  spaced pass  " }
        });
    });

    it("rejects missing, blank and non-text fields", () => {
        const bad = [
            { email: valid.email, password: valid.password },
            { name: valid.name, password: valid.password },
            { name: valid.name, email: valid.email },
            { ...valid, name: "   " },
            { ...valid, email: "   " },
            { ...valid, password: "" },
            { ...valid, name: 123 },
            { ...valid, email: {} },
            { ...valid, password: ["x"] }
        ];

        for (const body of bad) {
            expect(validateRegisterInput(body)).toEqual({
                ok: false,
                message: REQUIRED
            });
        }
    });

    it("rejects a body that is not an object", () => {
        for (const body of [undefined, null, "text", 42, ["a", "b"]]) {
            expect(validateRegisterInput(body)).toEqual({
                ok: false,
                message: REQUIRED
            });
        }
    });

    it("limits the name to 100 characters", () => {
        expect(
            validateRegisterInput({ ...valid, name: "a".repeat(100) }).ok
        ).toBe(true);

        expect(
            validateRegisterInput({ ...valid, name: "a".repeat(101) })
        ).toEqual({
            ok: false,
            message: "Name must be 100 characters or fewer"
        });
    });

    it("rejects invalid or too long emails", () => {
        const bad = [
            "no-at-sign",
            "a@b",
            "a b@example.com",
            "@example.com",
            "a@@example.com",
            `${"a".repeat(90)}@example.com`
        ];

        for (const email of bad) {
            expect(validateRegisterInput({ ...valid, email })).toEqual({
                ok: false,
                message: "Invalid email address"
            });
        }
    });

    it("requires a password of at least 8 characters", () => {
        expect(
            validateRegisterInput({ ...valid, password: "1234567" })
        ).toEqual({
            ok: false,
            message: "Password must be at least 8 characters long"
        });

        expect(
            validateRegisterInput({ ...valid, password: "12345678" }).ok
        ).toBe(true);
    });

    it("limits the password to 72 bytes, not 72 characters", () => {
        const tooManyBytes = {
            ok: false,
            message: "Password must be 72 bytes or fewer"
        };

        expect(
            validateRegisterInput({ ...valid, password: "a".repeat(72) }).ok
        ).toBe(true);

        expect(
            validateRegisterInput({ ...valid, password: "a".repeat(73) })
        ).toEqual(tooManyBytes);

        // "\u1230" is an Ethiopic letter. It takes 3 bytes in UTF-8.
        expect(
            validateRegisterInput({ ...valid, password: "\u1230".repeat(24) }).ok
        ).toBe(true);

        expect(
            validateRegisterInput({ ...valid, password: "\u1230".repeat(25) })
        ).toEqual(tooManyBytes);
    });
});

describe("validateLoginInput", () => {
    it("accepts valid input and lowercases the email", () => {
        expect(
            validateLoginInput({
                email: "  Abebe@Example.COM ",
                password: "anything"
            })
        ).toEqual({
            ok: true,
            value: { email: "abebe@example.com", password: "anything" }
        });
    });

    it("rejects missing, blank and non-text fields", () => {
        const bad = [
            undefined,
            null,
            {},
            { email: "a@b.co" },
            { password: "x" },
            { email: "  ", password: "x" },
            { email: "a@b.co", password: "" },
            { email: 5, password: "x" },
            { email: "a@b.co", password: {} }
        ];

        for (const body of bad) {
            expect(validateLoginInput(body)).toEqual({
                ok: false,
                message: "Email and password are required"
            });
        }
    });

    it("does not apply the registration password rules, so old accounts can still log in", () => {
        expect(
            validateLoginInput({ email: "old@example.com", password: "x" }).ok
        ).toBe(true);
    });
});
