import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import {
    createFixtures,
    removeFixtures,
    type Fixtures
} from "./helpers/fixtures.js";

let fixtures: Fixtures;

beforeAll(async () => {
    fixtures = await createFixtures("dashboard");
});

afterAll(async () => {
    await removeFixtures(fixtures);
});

const authorization = () => `Bearer ${fixtures.token}`;

const getStats = async () => {
    const response = await request(app)
        .get("/api/dashboard")
        .set("Authorization", authorization());

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    return response.body.data;
};

describe("Dashboard", () => {
    it("rejects a request without a token", async () => {
        const response = await request(app).get("/api/dashboard");

        expect(response.status).toBe(401);
        expect(response.body).toEqual({
            success: false,
            message: "Authentication required"
        });
    });

    it("returns every statistic with the documented types", async () => {
        const stats = await getStats();

        for (const key of [
            "totalProducts",
            "totalCustomers",
            "totalSales",
            "lowStockProductsCount"
        ]) {
            expect(Number.isInteger(stats[key])).toBe(true);
            expect(stats[key]).toBeGreaterThanOrEqual(0);
        }

        // The fixtures of this file are in the tables
        expect(stats.totalProducts).toBeGreaterThanOrEqual(1);
        expect(stats.totalCustomers).toBeGreaterThanOrEqual(1);

        // Money arrives as a decimal string
        expect(stats.totalRevenue).toMatch(/^\d+(\.\d+)?$/);

        expect(Array.isArray(stats.recentSales)).toBe(true);
        expect(stats.recentSales.length).toBeLessThanOrEqual(5);

        expect(Array.isArray(stats.lowStockProducts)).toBe(true);
        expect(stats.lowStockProducts.length).toBeLessThanOrEqual(10);
        expect(stats.lowStockProductsCount).toBeGreaterThanOrEqual(
            stats.lowStockProducts.length
        );

        const stocks: number[] = stats.lowStockProducts.map(
            (product: { stock_quantity: number }) => product.stock_quantity
        );

        for (const stock of stocks) {
            expect(stock).toBeLessThanOrEqual(5);
        }

        // Lowest stock first
        expect(stocks).toEqual([...stocks].sort((a, b) => a - b));
    });

    it("changes the statistics after a sale", async () => {
        const before = await getStats();

        const sale = await request(app)
            .post("/api/sales")
            .set("Authorization", authorization())
            .send({
                customer_id: fixtures.customerId,
                items: [{ product_id: fixtures.productId, quantity: 5 }]
            });

        expect(sale.status).toBe(201);

        const after = await getStats();

        expect(after.totalSales).toBe(before.totalSales + 1);

        // 5 units at 100 each
        expect(
            Number(after.totalRevenue) - Number(before.totalRevenue)
        ).toBeCloseTo(500, 2);

        // Stock fell from 10 to 5, which counts as low stock
        expect(after.lowStockProductsCount).toBe(
            before.lowStockProductsCount + 1
        );

        expect(after.recentSales[0]).toMatchObject({
            id: sale.body.data.sale.id,
            customer_name: "BizTrack Test Customer",
            total_amount: "500.00"
        });
    });
});
