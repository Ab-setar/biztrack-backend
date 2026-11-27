// What every validator returns: the cleaned value, or a message for the client
export type ValidationResult<T> =
    | { ok: true; value: T }
    | { ok: false; message: string };

// Treats anything that is not an object as an empty object
export const asRecord = (body: unknown): Record<string, unknown> =>
    typeof body === "object" && body !== null
        ? (body as Record<string, unknown>)
        : {};
