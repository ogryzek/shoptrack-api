-- Seed data for demos and SQL practice

INSERT INTO categories (id, name, description) VALUES
  (1, 'Electronics', 'Devices and accessories'),
  (2, 'Apparel', 'Clothing and wearables'),
  (3, 'Home', 'Home and kitchen'),
  (4, 'Books', 'Print and digital books');

INSERT INTO products (id, category_id, sku, name, description, price, stock_qty) VALUES
  (1, 1, 'EL-USB-C', 'USB-C Hub', '7-in-1 hub with HDMI', 49.99, 120),
  (2, 1, 'EL-NOISE', 'Noise Cancelling Headphones', 'Over-ear wireless', 129.00, 45),
  (3, 1, 'EL-MOUSE', 'Wireless Mouse', 'Ergonomic mouse', 24.50, 200),
  (4, 2, 'AP-TEE-M', 'Logo T-Shirt (M)', 'Cotton tee, medium', 18.00, 80),
  (5, 2, 'AP-HOOD-L', 'Campus Hoodie (L)', 'Fleece hoodie, large', 42.00, 35),
  (6, 3, 'HM-MUG', 'Ceramic Mug', '12oz mug', 12.00, 150),
  (7, 3, 'HM-LAMP', 'Desk Lamp', 'LED desk lamp', 36.75, 60),
  (8, 4, 'BK-SQL-01', 'Practical SQL', 'Developer-focused SQL guide', 39.95, 90),
  (9, 4, 'BK-NODE-01', 'Node Patterns', 'Express and API design', 44.00, 70);

INSERT INTO customers (id, email, first_name, last_name, city, country) VALUES
  (1, 'ava.nguyen@example.com', 'Ava', 'Nguyen', 'Boston', 'USA'),
  (2, 'ben.ortiz@example.com', 'Ben', 'Ortiz', 'Austin', 'USA'),
  (3, 'cara.singh@example.com', 'Cara', 'Singh', 'Toronto', 'Canada'),
  (4, 'diego.ramos@example.com', 'Diego', 'Ramos', 'Madrid', 'Spain'),
  (5, 'emma.klein@example.com', 'Emma', 'Klein', 'Berlin', 'Germany');

INSERT INTO orders (id, customer_id, status, ordered_at, total_amount) VALUES
  (1, 1, 'paid',     '2026-01-12 14:22:00', 178.99),
  (2, 1, 'shipped',  '2026-02-03 09:10:00',  42.00),
  (3, 2, 'paid',     '2026-02-15 16:45:00',  73.25),
  (4, 3, 'pending',  '2026-03-01 11:05:00',  93.95),
  (5, 3, 'paid',     '2026-03-08 18:30:00', 191.00),
  (6, 4, 'cancelled','2026-03-10 08:00:00',  24.50),
  (7, 5, 'shipped',  '2026-03-12 13:15:00',  80.75);

INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
  (1, 2, 1, 129.00),
  (1, 1, 1,  49.99),
  (2, 5, 1,  42.00),
  (3, 3, 1,  24.50),
  (3, 7, 1,  36.75),
  (3, 6, 1,  12.00),
  (4, 8, 1,  39.95),
  (4, 5, 1,  42.00),
  (4, 6, 1,  12.00),
  (5, 2, 1, 129.00),
  (5, 4, 1,  18.00),
  (5, 9, 1,  44.00),
  (6, 3, 1,  24.50),
  (7, 7, 1,  36.75),
  (7, 9, 1,  44.00);