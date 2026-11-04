ALTER TABLE products
    ADD CONSTRAINT products_stock_quantity_non_negative
    CHECK (stock_quantity >= 0);

ALTER TABLE products
    ADD CONSTRAINT products_price_non_negative
    CHECK (price >= 0);

ALTER TABLE sales
    ADD CONSTRAINT sales_total_amount_non_negative
    CHECK (total_amount >= 0);

ALTER TABLE sale_items
    ADD CONSTRAINT sale_items_sale_product_unique
    UNIQUE (sale_id, product_id);
