import { afterEach, describe, it, expect, vi } from "vitest";
import { createEnvReader } from "../../src/envReader.js";

// Undo every vi.stubEnv after each test
afterEach(() => {
    vi.unstubAllEnvs();
});

const messageOf = (action: () => void): string => {
    try {
        action();
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }

    return "";
};

describe("createEnvReader", () => {
    it("uses the fallback when a variable is missing", () => {
        const env = createEnvReader();

        expect(env.text("UNIT_TEXT", "fallback")).toBe("fallback");
        expect(env.port("UNIT_PORT", 5000)).toBe(5000);
        expect(env.integer("UNIT_INT", 300, 1, 1000)).toBe(300);
        expect(env.flag("UNIT_FLAG", true)).toBe(true);
        expect(env.choice("UNIT_CHOICE", ["a", "b"] as const, "a")).toBe("a");
        expect(
            env.originList("UNIT_ORIGINS", ["http://localhost:5173"])
        ).toEqual(["http://localhost:5173"]);
        expect(() => env.assertValid()).not.toThrow();
    });

    it("reads valid values", () => {
        vi.stubEnv("UNIT_TEXT", "hello");
        vi.stubEnv("UNIT_PORT", "8080");
        vi.stubEnv("UNIT_INT", "25");
        vi.stubEnv("UNIT_CHOICE", "b");
        vi.stubEnv(
            "UNIT_ORIGINS",
            "http://localhost:5173,https://app.example.com"
        );

        const env = createEnvReader();

        expect(env.text("UNIT_TEXT", "fallback")).toBe("hello");
        expect(env.port("UNIT_PORT", 5000)).toBe(8080);
        expect(env.integer("UNIT_INT", 300, 1, 1000)).toBe(25);
        expect(env.choice("UNIT_CHOICE", ["a", "b"] as const, "a")).toBe("b");
        expect(env.originList("UNIT_ORIGINS", [])).toEqual([
            "http://localhost:5173",
            "https://app.example.com"
        ]);
        expect(() => env.assertValid()).not.toThrow();
    });

    it("trims spaces and treats a blank value as missing", () => {
        vi.stubEnv("UNIT_TEXT", "  padded  ");
        vi.stubEnv("UNIT_BLANK", "   ");
        vi.stubEnv(
            "UNIT_ORIGINS",
            " http://a.example.com ,, http://b.example.com, "
        );

        const env = createEnvReader();

        expect(env.text("UNIT_TEXT", "fallback")).toBe("padded");
        expect(env.text("UNIT_BLANK", "fallback")).toBe("fallback");
        expect(env.originList("UNIT_ORIGINS", [])).toEqual([
            "http://a.example.com",
            "http://b.example.com"
        ]);
        expect(() => env.assertValid()).not.toThrow();
    });

    it("reports an invalid port by name and never shows its value", () => {
        for (const value of ["abc", "0", "65536", "80.5", "secret-port-value"]) {
            vi.stubEnv("UNIT_PORT", value);

            const env = createEnvReader();
            env.port("UNIT_PORT", 5000);

            const message = messageOf(() => env.assertValid());

            expect(message).toContain(
                "UNIT_PORT must be a whole number between 1 and 65535"
            );
            expect(message).not.toContain("secret-port-value");
        }
    });

    it("reports a missing or blank required variable", () => {
        vi.stubEnv("UNIT_BLANK_SECRET", "   ");

        const env = createEnvReader();

        expect(env.required("UNIT_MISSING_SECRET")).toBe("");
        expect(env.required("UNIT_BLANK_SECRET")).toBe("");

        const message = messageOf(() => env.assertValid());

        expect(message).toContain("UNIT_MISSING_SECRET is required");
        expect(message).toContain("UNIT_BLANK_SECRET is required");
    });

    it("rejects invalid origins without showing them", () => {
        const bad = [
            "http://localhost:5173/",
            "*",
            "localhost:5173",
            "ftp://example.com",
            "not a url",
            "http://a.example.com,*",
            "https://secret-origin.example/path"
        ];

        for (const value of bad) {
            vi.stubEnv("UNIT_ORIGINS", value);

            const env = createEnvReader();
            env.originList("UNIT_ORIGINS", []);

            const message = messageOf(() => env.assertValid());

            expect(message).toContain(
                "UNIT_ORIGINS must be a comma separated list of origins"
            );
            expect(message).not.toContain("secret-origin");
        }
    });

    it("accepts integers inside the range and rejects everything else", () => {
        vi.stubEnv("UNIT_LOW", "1");
        vi.stubEnv("UNIT_HIGH", "1000");

        const ok = createEnvReader();

        expect(ok.integer("UNIT_LOW", 5, 1, 1000)).toBe(1);
        expect(ok.integer("UNIT_HIGH", 5, 1, 1000)).toBe(1000);
        expect(() => ok.assertValid()).not.toThrow();

        for (const value of ["0", "1001", "-1", "1e2", "0x10", "12.5", "abc"]) {
            vi.stubEnv("UNIT_INT", value);

            const env = createEnvReader();

            expect(env.integer("UNIT_INT", 300, 1, 1000)).toBe(300);
            expect(messageOf(() => env.assertValid())).toContain(
                "UNIT_INT must be a whole number between 1 and 1000"
            );
        }
    });

    it("accepts only true or false for flags", () => {
        vi.stubEnv("UNIT_FLAG_ON", "true");
        vi.stubEnv("UNIT_FLAG_OFF", "false");

        const ok = createEnvReader();

        expect(ok.flag("UNIT_FLAG_ON", false)).toBe(true);
        expect(ok.flag("UNIT_FLAG_OFF", true)).toBe(false);
        expect(() => ok.assertValid()).not.toThrow();

        for (const value of ["yes", "1", "TRUE", "True", "on"]) {
            vi.stubEnv("UNIT_FLAG", value);

            const env = createEnvReader();
            env.flag("UNIT_FLAG", false);

            expect(messageOf(() => env.assertValid())).toContain(
                "UNIT_FLAG must be true or false"
            );
        }
    });

    it("accepts only the listed choices", () => {
        vi.stubEnv("UNIT_LEVEL_OK", "debug");

        const ok = createEnvReader();

        expect(
            ok.choice("UNIT_LEVEL_OK", ["info", "debug"] as const, "info")
        ).toBe("debug");
        expect(() => ok.assertValid()).not.toThrow();

        vi.stubEnv("UNIT_LEVEL", "verbose");

        const env = createEnvReader();

        expect(
            env.choice("UNIT_LEVEL", ["info", "debug"] as const, "info")
        ).toBe("info");
        expect(messageOf(() => env.assertValid())).toContain(
            "UNIT_LEVEL must be one of: info, debug"
        );
    });

    it("reports every problem at once", () => {
        vi.stubEnv("UNIT_PORT", "abc");
        vi.stubEnv("UNIT_FLAG", "maybe");

        const env = createEnvReader();
        env.port("UNIT_PORT", 5000);
        env.flag("UNIT_FLAG", false);
        env.required("UNIT_MISSING_SECRET");

        const message = messageOf(() => env.assertValid());

        expect(message).toContain("Invalid environment configuration");
        expect(message).toContain("UNIT_PORT");
        expect(message).toContain("UNIT_FLAG");
        expect(message).toContain("UNIT_MISSING_SECRET");
    });
});
