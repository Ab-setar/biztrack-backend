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
    fixtures = await createFixtures("sales-read");
});

afterAll(async () => {
    await removeFixtures(fixtures);
});

const authorization = () => `Bearer ${fixtures.token}`;

// Creates a sale of the fixture product (100 each) and returns it
const createSale = async (quantity: number) => {
    const response = await request(app)
        .post("/api/sales")
        .set("Authorization", authorization())
        .send({
            customer_id: fixtures.customerId,
            items: [{ product_id: fixtures.productId, quantity }]
        });

    expect(response.status).toBe(201);

    return response.body.data.sale as { id: number };
};

describe("Reading sales", () => {
    it("lists sales newest first and paginates them", async () => {
        const first = await createSale(1);
        const second = await createSale(2);

        const page1 = await request(app)
            .get(`/api/sales?customer_id=${fixtures.customerId}&limit=1&page=1`)
            .set("Authorization", authorization());

        expect(page1.status).toBe(200);
        expect(page1.body.data.pagination).toEqual({
            page: 1,
            limit: 1,
            total: 2,
            totalPages: 2,
            count: 1
        });
        expect(page1.body.data.sales).toEqual([
            {
                id: second.id,
                customer_name: "BizTrack Test Customer",
                total_amount: "200.00",
                created_at: expect.any(String)
            }
        ]);

        const page2 = await request(app)
            .get(`/api/sales?customer_id=${fixtures.customerId}&limit=1&page=2`)
            .set("Authorization", authorization());

        expect(page2.body.data.pagination).toEqual({
            page: 2,
            limit: 1,
            total: 2,
            totalPages: 2,
            count: 1
        });
        expect(page2.body.data.sales).toEqual([
            {
                id: first.id,
                customer_name: "BizTrack Test Customer",
                total_amount: "100.00",
                created_at: expect.any(String)
            }
        ]);
    });

    it("returns an empty list for a customer without sales", async () => {
        const response = await request(app)
            .get("/api/sales?customer_id=2147483647")
            .set("Authorization", authorization());

        expect(response.status).toBe(200);
        expect(response.body.data.sales).toEqual([]);
        expect(response.body.data.pagination).toEqual({
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 0,
            count: 0
        });
    });

    it("returns one sale with its items", async () => {
        const sale = await createSale(3);

        const response = await request(app)
            .get(`/api/sales/${sale.id}`)
            .set("Authorization", authorization());

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            success: true,
            data: {
                id: sale.id,
                customer_name: "BizTrack Test Customer",
                total_amount: "300.00",
                created_at: expect.any(String),
                items: [
                    {
                        product_name: "Laptop Pro",
                        quantity: 3,
                        unit_price: "100.00"
                    }
                ]
            }
        });
    });

    it("answers 404 for a valid id that does not exist", async () => {
        const response = await request(app)
            .get("/api/sales/2147483647")
            .set("Authorization", authorization());

        expect(response.status).toBe(404);
        expect(response.body).toEqual({
            success: false,
            message: "Sale not found"
        });
    });
});
