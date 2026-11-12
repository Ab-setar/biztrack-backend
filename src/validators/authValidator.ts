const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// bcrypt ignores everything after the first 72 bytes of a password
const MAX_PASSWORD_BYTES = 72;
const MIN_PASSWORD_LENGTH = 8;
const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 100;

export type ValidationResult<T> =
    | { ok: true; value: T }
    | { ok: false; message: string };

export type RegisterInput = { name: string; email: string; password: string };
export type LoginInput = { email: string; password: string };

const asRecord = (body: unknown): Record<string, unknown> =>
    typeof body === "object" && body !== null
        ? (body as Record<string, unknown>)
        : {};

export const validateRegisterInput = (
    body: unknown
): ValidationResult<RegisterInput> => {
    const { name, email, password } = asRecord(body);

    if (
        typeof name !== "string" ||
        typeof email !== "string" ||
        typeof password !== "string" ||
        !name.trim() ||
        !email.trim() ||
        !password
    ) {
        return {
            ok: false,
            message: "Name, email and password are required"
        };
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanName.length > MAX_NAME_LENGTH) {
        return {
            ok: false,
            message: `Name must be ${MAX_NAME_LENGTH} characters or fewer`
        };
    }

    if (cleanEmail.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(cleanEmail)) {
        return { ok: false, message: "Invalid email address" };
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
        return {
            ok: false,
            message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`
        };
    }

    if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
        return {
            ok: false,
            message: `Password must be ${MAX_PASSWORD_BYTES} bytes or fewer`
        };
    }

    // Never trim a password: spaces may be part of it
    return {
        ok: true,
        value: { name: cleanName, email: cleanEmail, password }
    };
};

export const validateLoginInput = (
    body: unknown
): ValidationResult<LoginInput> => {
    const { email, password } = asRecord(body);

    if (
        typeof email !== "string" ||
        typeof password !== "string" ||
        !email.trim() ||
        !password
    ) {
        return { ok: false, message: "Email and password are required" };
    }

    return {
        ok: true,
        value: { email: email.trim().toLowerCase(), password }
    };
};
