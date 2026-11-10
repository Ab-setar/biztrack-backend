// Small building blocks shared by the OpenAPI description files.

export const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

export const jsonContent = (schema: object) => ({
    content: { "application/json": { schema } }
});

export const success = (data: object) => ({
    type: "object",
    properties: {
        success: { type: "boolean", example: true },
        data
    },
    required: ["success", "data"]
});

export const money = {
    type: "string",
    example: "200.00",
    description: "Decimal amount sent as a string (PostgreSQL NUMERIC)"
};

export const timestamp = { type: "string", format: "date-time" };

export const messageOnly = ref("MessageOnly");
export const errorBody = ref("ErrorResponse");
export const unauthorized = { $ref: "#/components/responses/Unauthorized" };

export const forbidden = {
    description: "Only the owner role may do this",
    ...jsonContent(messageOnly)
};

export const serverError = {
    description: "Server error",
    ...jsonContent(errorBody)
};

export const notFound = (what: string) => ({
    description: `${what} not found`,
    ...jsonContent(errorBody)
});

export const pageParam = {
    name: "page",
    in: "query",
    schema: { type: "integer", minimum: 1, default: 1 }
};

export const limitParam = {
    name: "limit",
    in: "query",
    schema: { type: "integer", minimum: 1, maximum: 100, default: 10 }
};

export const idPathParam = (what: string) => ({
    name: "id",
    in: "path",
    required: true,
    description: `Id of the ${what}`,
    schema: { type: "integer", minimum: 1 }
});

export const invalidId = {
    description: "The id is not a whole number between 1 and 2147483647",
    ...jsonContent(errorBody)
};

type LooseOperation = {
    responses: Record<string, { description?: string }>;
};

// Every path with {id} can return 400 for a bad id.
// Call this once, when the spec is built.
export const addInvalidIdResponses = (
    paths: Record<string, Record<string, unknown>>
): void => {
    for (const [path, operations] of Object.entries(paths)) {
        if (!path.includes("{id}")) {
            continue;
        }

        for (const operation of Object.values(operations) as LooseOperation[]) {
            const existing = operation.responses["400"];

            if (existing) {
                existing.description = `${existing.description ?? "Bad request"}, or the id is not a valid number`;
            } else {
                operation.responses["400"] = { ...invalidId };
            }
        }
    }
};
