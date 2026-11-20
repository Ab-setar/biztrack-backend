import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app.js";

describe("API documentation", () => {
    it("serves the OpenAPI spec", async () => {
        const response = await request(app).get("/api-docs/openapi.json");

        expect(response.status).toBe(200);
        expect(response.body.openapi).toBe("3.0.3");
        expect(Object.keys(response.body.paths)).toEqual(
            expect.arrayContaining([
                "/health",
                "/api/auth/login",
                "/api/auth/register",
                "/api/sales",
                "/api/sales/{id}",
                "/api/dashboard"
            ])
        );
    });
});

describe("API documentation coverage", () => {
    it("documents the product and customer endpoints", async () => {
        const response = await request(app).get("/api-docs/openapi.json");
        const { paths } = response.body;

        expect(Object.keys(paths["/api/products"]).sort()).toEqual(["get", "post"]);
        expect(Object.keys(paths["/api/products/{id}"]).sort()).toEqual(["delete", "get", "put"]);
        expect(Object.keys(paths["/api/customers"]).sort()).toEqual(["get", "post"]);
        expect(Object.keys(paths["/api/customers/{id}"]).sort()).toEqual(["delete", "get", "put"]);
    });
});

describe("API documentation of ids", () => {
    it("documents a 400 response for every path with an id", async () => {
        const response = await request(app).get("/api-docs/openapi.json");

        const idPaths = Object.entries(
            response.body.paths as Record<string, Record<string, { responses: Record<string, unknown> }>>
        ).filter(([path]) => path.includes("{id}"));

        expect(idPaths.length).toBeGreaterThan(0);

        for (const [, operations] of idPaths) {
            for (const operation of Object.values(operations)) {
                expect(operation.responses["400"]).toBeDefined();
            }
        }
    });
});
