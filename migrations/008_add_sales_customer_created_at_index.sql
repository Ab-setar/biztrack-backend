CREATE INDEX idx_sales_customer_created_at
ON sales (customer_id, created_at DESC);
