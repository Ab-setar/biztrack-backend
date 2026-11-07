import {
    ref,
    jsonContent,
    success,
    timestamp,
    errorBody,
    unauthorized,
    forbidden,
    serverError,
    notFound,
    pageParam,
    limitParam,
    idPathParam
} from "./helpers.js";

export const customerPaths = {
    "/api/customers": {
        get: {
            tags: ["Customers"],
            summary: "List customers, newest first",
            parameters: [
                pageParam,
                limitParam,
                {
                    name: "search",
                    in: "query",
                    description:
                        "Part of the name, phone or email, ignoring case",
                    schema: { type: "string" }
                }
            ],
            responses: {
                "200": {
                    description: "A page of customers",
                    ...jsonContent(
                        success({
                            type: "object",
                            properties: {
                                customers: {
                                    type: "array",
                                    items: ref("Customer")
                                },
                                pagination: ref("Pagination")
                            }
                        })
                    )
                },
                "400": {
                    description: "Invalid pagination parameters",
                    ...jsonContent(errorBody)
                },
                "401": unauthorized,
                "500": serverError
            }
        },
        post: {
            tags: ["Customers"],
            summary: "Create a customer",
            requestBody: {
                required: true,
                content: {
                    "application/json": { schema: ref("CustomerInput") }
                }
            },
            responses: {
                "201": {
                    description: "Customer created",
                    ...jsonContent(success(ref("Customer")))
                },
                "400": {
                    description: "Invalid customer data or invalid email address",
                    ...jsonContent(errorBody)
                },
                "401": unauthorized,
                "500": serverError
            }
        }
    },

    "/api/customers/{id}": {
        get: {
            tags: ["Customers"],
            summary: "Get one customer",
            parameters: [idPathParam("customer")],
            responses: {
                "200": {
                    description: "The customer",
                    ...jsonContent(success(ref("Customer")))
                },
                "401": unauthorized,
                "404": notFound("Customer"),
                "500": serverError
            }
        },
        put: {
            tags: ["Customers"],
            summary: "Update a customer",
            description:
                "Replaces the whole customer. A phone or email you leave out is cleared.",
            parameters: [idPathParam("customer")],
            requestBody: {
                required: true,
                content: {
                    "application/json": { schema: ref("CustomerInput") }
                }
            },
            responses: {
                "200": {
                    description: "The updated customer",
                    ...jsonContent(success(ref("Customer")))
                },
                "400": {
                    description: "Invalid customer data or invalid email address",
                    ...jsonContent(errorBody)
                },
                "401": unauthorized,
                "404": notFound("Customer"),
                "500": serverError
            }
        },
        delete: {
            tags: ["Customers"],
            summary: "Delete a customer (owner only)",
            parameters: [idPathParam("customer")],
            responses: {
                "200": {
                    description: "Customer deleted",
                    ...jsonContent(
                        success({
                            type: "object",
                            properties: {
                                message: {
                                    type: "string",
                                    example: "Customer deleted successfully"
                                },
                                customer: ref("Customer")
                            }
                        })
                    )
                },
                "401": unauthorized,
                "403": forbidden,
                "404": notFound("Customer"),
                "409": {
                    description:
                        "The customer has existing sales and cannot be deleted",
                    ...jsonContent(errorBody)
                },
                "500": serverError
            }
        }
    }
};

export const customerSchemas = {
    Customer: {
        type: "object",
        properties: {
            id: { type: "integer", example: 3 },
            name: { type: "string", example: "Abebe Kebede" },
            phone: { type: "string", nullable: true, example: "0911223344" },
            email: {
                type: "string",
                format: "email",
                nullable: true,
                example: "abebe@example.com"
            },
            created_at: timestamp
        }
    },
    CustomerInput: {
        type: "object",
        required: ["name"],
        properties: {
            name: {
                type: "string",
                minLength: 1,
                example: "Abebe Kebede",
                description: "Spaces at both ends are removed"
            },
            phone: {
                type: "string",
                example: "0911223344",
                description:
                    "Optional. Leave it out instead of sending null or an empty string"
            },
            email: {
                type: "string",
                format: "email",
                example: "abebe@example.com",
                description:
                    "Optional, saved in lower case. Leave it out instead of sending null or an empty string"
            }
        }
    }
};
