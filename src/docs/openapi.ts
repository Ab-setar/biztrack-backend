// OpenAPI 3.0 description of the BizTrack API.
// Keep it in sync with the controllers: change both in the same commit.

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

const jsonContent = (schema: object) => ({
    content: { "application/json": { schema } }
});

const success = (data: object) => ({
    type: "object",
    properties: {
        success: { type: "boolean", example: true },
        data
    },
    required: ["success", "data"]
});

const money = {
    type: "string",
    example: "200.00",
    description: "Decimal amount sent as a string (PostgreSQL NUMERIC)"
};

const timestamp = { type: "string", format: "date-time" };

const messageOnly = ref("MessageOnly");
const errorBody = ref("ErrorResponse");
const unauthorized = { $ref: "#/components/responses/Unauthorized" };

export const openApiSpec = {
    openapi: "3.0.3",
    info: {
        title: "BizTrack API",
        version: "1.0.0",
        description:
            "Business management API: products, customers, sales and a dashboard. " +
            "Log in with POST /api/auth/login, then send the token as a Bearer token."
    },
    servers: [{ url: "/" }],
    tags: [
        { name: "Health" },
        { name: "Auth" },
        { name: "Sales" },
        { name: "Dashboard" }
    ],
    security: [{ bearerAuth: [] }],
    paths: {
        "/health": {
            get: {
                tags: ["Health"],
                summary: "Check that the API is running",
                security: [],
                responses: {
                    "200": {
                        description: "The API is healthy",
                        ...jsonContent({
                            type: "object",
                            properties: {
                                success: { type: "boolean", example: true },
                                message: {
                                    type: "string",
                                    example: "BizTrack API is healthy"
                                }
                            }
                        })
                    }
                }
            }
        },

        "/api/auth/register": {
            post: {
                tags: ["Auth"],
                summary: "Register a new user",
                description: "New users always get the employee role.",
                security: [],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": { schema: ref("RegisterRequest") }
                    }
                },
                responses: {
                    "201": {
                        description: "User created",
                        ...jsonContent({
                            type: "object",
                            properties: {
                                message: {
                                    type: "string",
                                    example: "User registered successfully"
                                },
                                user: ref("RegisteredUser")
                            }
                        })
                    },
                    "400": {
                        description: "Name, email or password is missing",
                        ...jsonContent(messageOnly)
                    },
                    "409": {
                        description: "Email already exists",
                        ...jsonContent(messageOnly)
                    },
                    "500": {
                        description: "Server error",
                        ...jsonContent(messageOnly)
                    }
                }
            }
        },

        "/api/auth/login": {
            post: {
                tags: ["Auth"],
                summary: "Log in and get a token",
                description:
                    "The token expires after 1 hour. Login is rate limited: " +
                    "10 attempts per 15 minutes.",
                security: [],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": { schema: ref("LoginRequest") }
                    }
                },
                responses: {
                    "200": {
                        description: "Login successful",
                        ...jsonContent({
                            type: "object",
                            properties: {
                                message: {
                                    type: "string",
                                    example: "Login successful"
                                },
                                token: { type: "string" },
                                user: ref("User")
                            }
                        })
                    },
                    "400": {
                        description: "Email or password is missing",
                        ...jsonContent(messageOnly)
                    },
                    "401": {
                        description: "Invalid email or password",
                        ...jsonContent(messageOnly)
                    },
                    "429": {
                        description: "Too many login attempts",
                        ...jsonContent(errorBody)
                    },
                    "500": {
                        description: "Server error",
                        ...jsonContent(messageOnly)
                    }
                }
            }
        },

        "/api/sales": {
            get: {
                tags: ["Sales"],
                summary: "List sales, newest first",
                parameters: [
                    {
                        name: "page",
                        in: "query",
                        schema: { type: "integer", minimum: 1, default: 1 }
                    },
                    {
                        name: "limit",
                        in: "query",
                        schema: {
                            type: "integer",
                            minimum: 1,
                            maximum: 100,
                            default: 10
                        }
                    },
                    {
                        name: "customer_id",
                        in: "query",
                        description: "Only sales of this customer",
                        schema: { type: "integer", minimum: 1 }
                    }
                ],
                responses: {
                    "200": {
                        description: "A page of sales",
                        ...jsonContent(
                            success({
                                type: "object",
                                properties: {
                                    sales: {
                                        type: "array",
                                        items: ref("SaleSummary")
                                    },
                                    pagination: ref("Pagination")
                                }
                            })
                        )
                    },
                    "400": {
                        description: "Invalid pagination parameters or customer_id",
                        ...jsonContent(errorBody)
                    },
                    "401": unauthorized,
                    "500": {
                        description: "Server error",
                        ...jsonContent(errorBody)
                    }
                }
            },
            post: {
                tags: ["Sales"],
                summary: "Create a sale",
                description:
                    "Runs in one database transaction: checks stock, locks the " +
                    "products, saves the sale and its items, and lowers stock. " +
                    "A product can appear only once per sale.",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": { schema: ref("CreateSaleRequest") }
                    }
                },
                responses: {
                    "201": {
                        description: "Sale created",
                        ...jsonContent(
                            success({
                                type: "object",
                                properties: {
                                    message: {
                                        type: "string",
                                        example: "Sale created successfully"
                                    },
                                    sale: ref("Sale")
                                }
                            })
                        )
                    },
                    "400": {
                        description:
                            "Invalid customer or items, duplicate product, " +
                            "or not enough stock",
                        ...jsonContent(errorBody)
                    },
                    "401": unauthorized,
                    "404": {
                        description: "Customer or product not found",
                        ...jsonContent(errorBody)
                    },
                    "500": {
                        description: "Server error",
                        ...jsonContent(errorBody)
                    }
                }
            }
        },

        "/api/sales/{id}": {
            get: {
                tags: ["Sales"],
                summary: "Get one sale with its items",
                parameters: [
                    {
                        name: "id",
                        in: "path",
                        required: true,
                        schema: { type: "integer", minimum: 1 }
                    }
                ],
                responses: {
                    "200": {
                        description: "The sale",
                        ...jsonContent(success(ref("SaleDetail")))
                    },
                    "401": unauthorized,
                    "404": {
                        description: "Sale not found",
                        ...jsonContent(errorBody)
                    },
                    "500": {
                        description: "Server error",
                        ...jsonContent(errorBody)
                    }
                }
            }
        },

        "/api/dashboard": {
            get: {
                tags: ["Dashboard"],
                summary: "Get business statistics",
                responses: {
                    "200": {
                        description: "Dashboard statistics",
                        ...jsonContent(success(ref("DashboardStats")))
                    },
                    "401": unauthorized,
                    "500": {
                        description: "Server error",
                        ...jsonContent(errorBody)
                    }
                }
            }
        }
    },
    components: {
        securitySchemes: {
            bearerAuth: {
                type: "http",
                scheme: "bearer",
                bearerFormat: "JWT",
                description:
                    "Token from POST /api/auth/login. It expires after 1 hour."
            }
        },
        responses: {
            Unauthorized: {
                description: "Missing, invalid or expired token",
                ...jsonContent(messageOnly)
            }
        },
        schemas: {
            MessageOnly: {
                type: "object",
                properties: { message: { type: "string" } },
                required: ["message"]
            },
            ErrorResponse: {
                type: "object",
                properties: {
                    success: { type: "boolean", example: false },
                    message: { type: "string" }
                },
                required: ["success", "message"]
            },
            RegisterRequest: {
                type: "object",
                required: ["name", "email", "password"],
                properties: {
                    name: { type: "string", example: "Abebe Kebede" },
                    email: {
                        type: "string",
                        format: "email",
                        example: "abebe@example.com"
                    },
                    password: { type: "string", format: "password" }
                }
            },
            LoginRequest: {
                type: "object",
                required: ["email", "password"],
                properties: {
                    email: { type: "string", format: "email" },
                    password: { type: "string", format: "password" }
                }
            },
            User: {
                type: "object",
                properties: {
                    id: { type: "integer", example: 1 },
                    name: { type: "string" },
                    email: { type: "string", format: "email" },
                    role: { type: "string", enum: ["owner", "employee"] }
                }
            },
            RegisteredUser: {
                type: "object",
                properties: {
                    id: { type: "integer", example: 1 },
                    name: { type: "string" },
                    email: { type: "string", format: "email" },
                    role: { type: "string", enum: ["owner", "employee"] },
                    created_at: timestamp
                }
            },
            Sale: {
                type: "object",
                properties: {
                    id: { type: "integer", example: 12 },
                    customer_id: { type: "integer", example: 3 },
                    user_id: {
                        type: "integer",
                        nullable: true,
                        description: "Older sales may have no user"
                    },
                    total_amount: money,
                    created_at: timestamp
                }
            },
            SaleSummary: {
                type: "object",
                properties: {
                    id: { type: "integer", example: 12 },
                    customer_name: { type: "string" },
                    total_amount: money,
                    created_at: timestamp
                }
            },
            SaleDetail: {
                allOf: [
                    ref("SaleSummary"),
                    {
                        type: "object",
                        properties: {
                            items: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        product_name: { type: "string" },
                                        quantity: { type: "integer" },
                                        unit_price: money
                                    }
                                }
                            }
                        }
                    }
                ]
            },
            Pagination: {
                type: "object",
                properties: {
                    page: { type: "integer", example: 1 },
                    limit: { type: "integer", example: 10 },
                    total: { type: "integer", example: 42 },
                    totalPages: { type: "integer", example: 5 },
                    count: {
                        type: "integer",
                        description: "Number of items on this page"
                    }
                }
            },
            CreateSaleRequest: {
                type: "object",
                required: ["customer_id", "items"],
                properties: {
                    customer_id: { type: "integer", minimum: 1, example: 3 },
                    items: {
                        type: "array",
                        minItems: 1,
                        description: "Each product may appear only once",
                        items: {
                            type: "object",
                            required: ["product_id", "quantity"],
                            properties: {
                                product_id: {
                                    type: "integer",
                                    minimum: 1,
                                    example: 7
                                },
                                quantity: {
                                    type: "integer",
                                    minimum: 1,
                                    example: 2
                                }
                            }
                        }
                    }
                }
            },
            DashboardStats: {
                type: "object",
                properties: {
                    totalProducts: { type: "integer" },
                    totalCustomers: { type: "integer" },
                    totalSales: { type: "integer" },
                    totalRevenue: money,
                    lowStockProductsCount: {
                        type: "integer",
                        description: "Products with stock of 5 or less"
                    },
                    recentSales: {
                        type: "array",
                        description: "The 5 latest sales",
                        items: ref("SaleSummary")
                    },
                    lowStockProducts: {
                        type: "array",
                        description: "Up to 10 products, lowest stock first",
                        items: {
                            type: "object",
                            properties: {
                                id: { type: "integer" },
                                name: { type: "string" },
                                stock_quantity: { type: "integer" }
                            }
                        }
                    }
                }
            }
        }
    }
};
