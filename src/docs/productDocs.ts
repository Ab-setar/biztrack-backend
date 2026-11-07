import {
    ref,
    jsonContent,
    success,
    money,
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

export const productPaths = {
    "/api/products": {
        get: {
            tags: ["Products"],
            summary: "List products, newest first",
            parameters: [
                pageParam,
                limitParam,
                {
                    name: "search",
                    in: "query",
                    description: "Part of the product name, ignoring case",
                    schema: { type: "string" }
                },
                {
                    name: "minPrice",
                    in: "query",
                    description: "Lowest price to include",
                    schema: { type: "number", minimum: 0 }
                },
                {
                    name: "maxPrice",
                    in: "query",
                    description: "Highest price to include. Must not be below minPrice",
                    schema: { type: "number", minimum: 0 }
                },
                {
                    name: "inStock",
                    in: "query",
                    description: "true = stock above 0, false = stock is exactly 0",
                    schema: { type: "string", enum: ["true", "false"] }
                }
            ],
            responses: {
                "200": {
                    description: "A page of products",
                    ...jsonContent(
                        success({
                            type: "object",
                            properties: {
                                products: {
                                    type: "array",
                                    items: ref("Product")
                                },
                                pagination: ref("Pagination")
                            }
                        })
                    )
                },
                "400": {
                    description:
                        "Invalid pagination, price filter or inStock value",
                    ...jsonContent(errorBody)
                },
                "401": unauthorized,
                "500": serverError
            }
        },
        post: {
            tags: ["Products"],
            summary: "Create a product",
            requestBody: {
                required: true,
                content: {
                    "application/json": { schema: ref("ProductInput") }
                }
            },
            responses: {
                "201": {
                    description: "Product created",
                    ...jsonContent(success(ref("Product")))
                },
                "400": {
                    description: "Invalid product data",
                    ...jsonContent(errorBody)
                },
                "401": unauthorized,
                "500": serverError
            }
        }
    },

    "/api/products/{id}": {
        get: {
            tags: ["Products"],
            summary: "Get one product",
            parameters: [idPathParam("product")],
            responses: {
                "200": {
                    description: "The product",
                    ...jsonContent(success(ref("Product")))
                },
                "401": unauthorized,
                "404": notFound("Product"),
                "500": serverError
            }
        },
        put: {
            tags: ["Products"],
            summary: "Update a product",
            description:
                "Replaces name, price and stock_quantity. All three are required.",
            parameters: [idPathParam("product")],
            requestBody: {
                required: true,
                content: {
                    "application/json": { schema: ref("ProductInput") }
                }
            },
            responses: {
                "200": {
                    description: "The updated product",
                    ...jsonContent(success(ref("Product")))
                },
                "400": {
                    description: "Invalid product data",
                    ...jsonContent(errorBody)
                },
                "401": unauthorized,
                "404": notFound("Product"),
                "500": serverError
            }
        },
        delete: {
            tags: ["Products"],
            summary: "Delete a product (owner only)",
            parameters: [idPathParam("product")],
            responses: {
                "200": {
                    description: "Product deleted",
                    ...jsonContent(
                        success({
                            type: "object",
                            properties: {
                                message: {
                                    type: "string",
                                    example: "Product deleted successfully"
                                },
                                product: ref("Product")
                            }
                        })
                    )
                },
                "401": unauthorized,
                "403": forbidden,
                "404": notFound("Product"),
                "409": {
                    description:
                        "The product is used in existing sales and cannot be deleted",
                    ...jsonContent(errorBody)
                },
                "500": serverError
            }
        }
    }
};

export const productSchemas = {
    Product: {
        type: "object",
        properties: {
            id: { type: "integer", example: 7 },
            name: { type: "string", example: "Laptop Pro" },
            price: money,
            stock_quantity: { type: "integer", example: 10 },
            description: {
                type: "string",
                nullable: true,
                description: "Returned, but this API cannot set it yet"
            },
            created_at: timestamp
        }
    },
    ProductInput: {
        type: "object",
        required: ["name", "price", "stock_quantity"],
        properties: {
            name: {
                type: "string",
                minLength: 1,
                example: "Laptop Pro",
                description: "Spaces at both ends are removed"
            },
            price: {
                type: "number",
                minimum: 0,
                example: 100,
                description: "A JSON number, not a string"
            },
            stock_quantity: { type: "integer", minimum: 0, example: 10 }
        }
    }
};
