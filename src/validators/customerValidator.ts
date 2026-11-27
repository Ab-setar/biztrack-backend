import { asRecord, type ValidationResult } from "./validationResult.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// These limits come from the customers table:
// name is varchar(100), phone is varchar(20), email is varchar(100)
export const CUSTOMER_LIMITS = {
    nameMaxLength: 100,
    phoneMaxLength: 20,
    emailMaxLength: 100
} as const;

export type CustomerInput = {
    name: string;
    phone: string | null;
    email: string | null;
};

const INVALID = { ok: false, message: "Invalid customer data" } as const;

export const validateCustomerInput = (
    body: unknown
): ValidationResult<CustomerInput> => {
    const { name, phone, email } = asRecord(body);

    const cleanName = typeof name === "string" ? name.trim() : "";

    if (!cleanName) {
        return INVALID;
    }

    // Phone and email are optional: leave them out to store nothing.
    // null, an empty string and a value that is not text are errors.
    let cleanPhone: string | null = null;

    if (phone !== undefined) {
        cleanPhone = typeof phone === "string" ? phone.trim() : "";

        if (!cleanPhone) {
            return INVALID;
        }
    }

    let cleanEmail: string | null = null;

    if (email !== undefined) {
        cleanEmail =
            typeof email === "string" ? email.trim().toLowerCase() : "";

        if (!cleanEmail) {
            return INVALID;
        }
    }

    if (cleanName.length > CUSTOMER_LIMITS.nameMaxLength) {
        return {
            ok: false,
            message: `Name must be ${CUSTOMER_LIMITS.nameMaxLength} characters or fewer`
        };
    }

    if (cleanPhone !== null && cleanPhone.length > CUSTOMER_LIMITS.phoneMaxLength) {
        return {
            ok: false,
            message: `Phone must be ${CUSTOMER_LIMITS.phoneMaxLength} characters or fewer`
        };
    }

    if (cleanEmail !== null) {
        if (cleanEmail.length > CUSTOMER_LIMITS.emailMaxLength) {
            return {
                ok: false,
                message: `Email must be ${CUSTOMER_LIMITS.emailMaxLength} characters or fewer`
            };
        }

        if (!EMAIL_PATTERN.test(cleanEmail)) {
            return { ok: false, message: "Invalid email address" };
        }
    }

    return {
        ok: true,
        value: { name: cleanName, phone: cleanPhone, email: cleanEmail }
    };
};
