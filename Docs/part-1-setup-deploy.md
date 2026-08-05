# Part I: Application Setup, Git, Aiven MySQL, and Deploy to Render

In this part you will create a Node.js + Express application from scratch, put it under Git and GitHub, provision a MySQL database on Aiven, connect the app to that database, and deploy the API to Render.

By the end you should have:

1. A working Express API that reads from MySQL
2. Schema and seed data ready for the SQL lessons in Parts II and III
3. A way to query the Aiven database from the CLI and/or VS Code
4. The app live on Render, using the same Aiven database

**Prefer a finished codebase while you learn deploy steps?** Use the ready-to-run [reference app](./shoptrack-api/) and still complete the Aiven, GitHub, and Render sections below.

---

## 1. What we are building

**Project name:** `shoptrack-api`

A small store backend with these tables:

| Table | Purpose |
|-------|---------|
| `categories` | Product categories (Electronics, Apparel, ...) |
| `products` | Items for sale |
| `customers` | Shoppers |
| `orders` | One row per checkout |
| `order_items` | Line items (many products per order) |

That shape is deliberate. Parts II and III will use joins, views, and (later) CTEs against customer profiles, order history, and admin/analyst style dashboards.

**Stack choices:**

- **Node.js + Express** for the HTTP API
- **`mysql2`** for MySQL access (promise-based, widely used)
- **`dotenv`** for local environment variables
- **Aiven MySQL** as the hosted database (free tier available)
- **Render** as the host for the Express process (free tier available)
- **Git + GitHub** as the source of truth and the hook Render uses to deploy

---

## 2. Prerequisites

Install or confirm the following on your machine.

### 2.1 Node.js and npm

```bash
node -v
npm -v
```

Use Node.js 20 or newer if possible.

### 2.2 Git

```bash
git --version
```

### 2.3 Accounts

Create free accounts (if you do not already have them):

- [GitHub](https://github.com)
- [Render](https://dashboard.render.com/register)
- [Aiven](https://console.aiven.io/signup)

### 2.4 Optional tools (recommended)

**MySQL client** (for CLI queries against Aiven):

```bash
# macOS with Homebrew
brew install mysql-client

# Then ensure mysql is on your PATH, for example:
echo 'export PATH="/opt/homebrew/opt/mysql-client/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

mysql --version
```

On Windows, install MySQL Community Server or only the client tools, and use `mysql` from a terminal that has it on the PATH.

**Aiven CLI** (`avn`):

```bash
# Requires Python and pip
pip install aiven-client

avn --version
```

Log in after install:

```bash
avn user login
# follow the prompts (email/password or token as documented by Aiven)
```

**Render CLI** (`render`):

```bash
# macOS with Homebrew
brew install render

# or install script (Linux/macOS)
curl -fsSL https://raw.githubusercontent.com/render-oss/cli/refs/heads/main/bin/install.sh | sh

render
```

Log in:

```bash
render login
```

You can complete this entire tutorial with only the Aiven and Render **web dashboards**. The CLIs are optional shortcuts once you are comfortable with the flow.

---

## 3. Create the project

Pick a parent folder for class work, then:

```bash
mkdir shoptrack-api
cd shoptrack-api
npm init -y
```

Open `package.json` and adjust it so the project has a clear start script and modern defaults:

```json
{
  "name": "shoptrack-api",
  "version": "1.0.0",
  "description": "ShopTrack API - Express + MySQL on Render/Aiven",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js",
    "db:schema": "node src/db/run-schema.js",
    "db:seed": "node src/db/run-seed.js",
    "db:reset": "npm run db:schema && npm run db:seed"
  },
  "engines": {
    "node": ">=20"
  },
  "keywords": [],
  "author": "",
  "license": "MIT"
}
```

Install dependencies:

```bash
npm install express mysql2 dotenv
npm install --save-dev nodemon
```

(`nodemon` is optional if you use `node --watch`. Keep whichever you prefer for local development.)

Create the folder layout:

```bash
mkdir -p src/db src/routes certs
```

Suggested tree after Part I:

```text
shoptrack-api/
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
├── certs/
│   └── .gitkeep          # ca.pem lives here; often gitignored
├── sql/
│   ├── schema.sql
│   └── seed.sql
└── src/
    ├── app.js
    ├── server.js
    ├── config.js
    ├── db/
    │   ├── pool.js
    │   ├── run-schema.js
    │   └── run-seed.js
    └── routes/
        ├── health.js
        ├── products.js
        └── customers.js
```

---

## 4. Git ignore and environment template

### 4.1 `.gitignore`

Create `.gitignore` in the project root:

```gitignore
# Dependencies
node_modules/

# Environment and secrets
.env
.env.local
.env.*.local

# Aiven CA (optional: commit if your class prefers shared certs)
certs/*.pem
!certs/.gitkeep

# OS / editor
.DS_Store
Thumbs.db
.vscode/
.idea/

# Logs
npm-debug.log*
logs/
*.log
```

### 4.2 `.env.example` (safe to commit)

Create `.env.example` so teammates know which variables exist without seeing real secrets:

```env
NODE_ENV=development
PORT=3000

# Aiven MySQL connection (from the service Overview page)
DB_HOST=your-service.aivencloud.com
DB_PORT=12345
DB_USER=avnadmin
DB_PASSWORD=replace-me
DB_NAME=defaultdb

# Path to the CA certificate downloaded from Aiven
DB_SSL_CA=./certs/ca.pem
```

### 4.3 Local `.env` (never commit)

Copy the example and fill values after you create the Aiven service (Section 6):

```bash
cp .env.example .env
```

---

## 5. Application code

### 5.1 Configuration: `src/config.js`

Centralize env loading so the rest of the app does not scatter `process.env` calls:

```js
require('dotenv').config();
const fs = require('fs');
const path = require('path');

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  db: {
    host: required('DB_HOST'),
    port: Number(process.env.DB_PORT || 3306),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    database: required('DB_NAME'),
    // Aiven requires TLS. Prefer verifying with the project CA when available.
    ssl: buildSslConfig(),
  },
};

function buildSslConfig() {
  const caPath = process.env.DB_SSL_CA;
  if (caPath && fs.existsSync(path.resolve(caPath))) {
    return {
      rejectUnauthorized: true,
      ca: fs.readFileSync(path.resolve(caPath), 'utf8'),
    };
  }

  // Fallback: still use TLS, but do not verify the certificate chain.
  // Prefer downloading ca.pem for real work (see Section 6).
  if (process.env.DB_SSL === 'true' || process.env.DB_SSL === '1') {
    return { rejectUnauthorized: false };
  }

  // Local MySQL without SSL (optional later)
  return undefined;
}

module.exports = config;
```

**Render note:** Render injects `PORT`. Always listen on `process.env.PORT` (or `config.port` as above). Do not hardcode `3000` only.

### 5.2 Database pool: `src/db/pool.js`

```js
const mysql = require('mysql2/promise');
const config = require('../config');

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  ssl: config.db.ssl,
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
});

module.exports = pool;
```

### 5.3 Express app: `src/app.js`

```js
const express = require('express');
const healthRouter = require('./routes/health');
const productsRouter = require('./routes/products');
const customersRouter = require('./routes/customers');

const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    name: 'shoptrack-api',
    message: 'Part I is running. See /health and /api/products.',
  });
});

app.use('/health', healthRouter);
app.use('/api/products', productsRouter);
app.use('/api/customers', customersRouter);

// Basic error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

module.exports = app;
```

### 5.4 Server entry: `src/server.js`

```js
const app = require('./app');
const config = require('./config');

app.listen(config.port, () => {
  console.log(`shoptrack-api listening on port ${config.port} (${config.env})`);
});
```

### 5.5 Routes

**`src/routes/health.js`**

```js
const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS ok, NOW() AS server_time');
    res.json({
      status: 'ok',
      database: 'connected',
      result: rows[0],
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
```

**`src/routes/products.js`**

```js
const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

// List products with category name (a simple JOIN you will expand in Part II)
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        p.id,
        p.sku,
        p.name,
        p.price,
        p.stock_qty,
        c.name AS category_name
      FROM products p
      INNER JOIN categories c ON c.id = p.category_id
      ORDER BY p.id
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT
        p.id,
        p.sku,
        p.name,
        p.description,
        p.price,
        p.stock_qty,
        c.id AS category_id,
        c.name AS category_name
      FROM products p
      INNER JOIN categories c ON c.id = p.category_id
      WHERE p.id = :id
      `,
      { id: req.params.id }
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
```

**`src/routes/customers.js`**

```js
const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, email, first_name, last_name, city, country, created_at
      FROM customers
      ORDER BY id
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Lightweight "profile" shape; Part II will deepen this with views and joins
router.get('/:id/profile', async (req, res, next) => {
  try {
    const customerId = req.params.id;

    const [customers] = await pool.query(
      `
      SELECT id, email, first_name, last_name, city, country, created_at
      FROM customers
      WHERE id = :id
      `,
      { id: customerId }
    );

    if (customers.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const [orders] = await pool.query(
      `
      SELECT
        o.id AS order_id,
        o.status,
        o.ordered_at,
        o.total_amount,
        COUNT(oi.id) AS line_count
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE o.customer_id = :id
      GROUP BY o.id, o.status, o.ordered_at, o.total_amount
      ORDER BY o.ordered_at DESC
      `,
      { id: customerId }
    );

    res.json({
      customer: customers[0],
      orders,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
```

---

## 6. Create the Aiven MySQL service

### 6.1 Console (primary path)

1. Sign in at [https://console.aiven.io](https://console.aiven.io).
2. Create or open a **project** (for example `my-project`).
3. Click **Services** → **Create service**.
4. Choose **MySQL**.
5. Select the **Free** tier / plan when available (or the lowest hobby plan if free is not shown in your region).
6. Name the service something memorable, for example `shoptrack-mysql`.
7. Click **Create service** and wait until status is **Running** (often a few minutes).

### 6.2 Connection information

On the service **Overview** page, open **Connection information**. You will need:

- Host
- Port
- User (often `avnadmin`)
- Password
- Database name (often `defaultdb`)

Also download the **CA certificate** (`ca.pem`) from the same area (SSL / certificates section).

Save it in your project:

```bash
# After download, move/rename into the project:
mv ~/Downloads/ca.pem ./certs/ca.pem
```

### 6.3 Fill in `.env`

Edit `.env` with the real values from Aiven:

```env
NODE_ENV=development
PORT=3000

DB_HOST=shoptrack-mysql-....aivencloud.com
DB_PORT=12345
DB_USER=avnadmin
DB_PASSWORD=the-password-from-aiven
DB_NAME=defaultdb
DB_SSL_CA=./certs/ca.pem
```

If the CA file is missing and you need a temporary workaround for class:

```env
DB_SSL=true
```

Prefer the CA file for anything beyond a quick demo.

### 6.4 Optional: create the service with the Aiven CLI

If you installed `avn` and authenticated:

```bash
# List projects
avn project list

# Set default project
avn project switch my-project

# Create MySQL (plan names change; use Free/hobbyist style plan available to you)
avn service create shoptrack-mysql \
  --service-type mysql \
  --plan free \
  --cloud google-us-east1
```

If `--plan free` is rejected, run `avn service plans --service-type mysql` (with cloud if required) and pick a listed plan name.

Get connection details:

```bash
avn service get shoptrack-mysql --json
avn service user-list shoptrack-mysql
```

Download CA:

```bash
avn service ca get --project my-project > certs/ca.pem
```

Exact flags can vary slightly by CLI version; `avn help service` is the source of truth.

### 6.5 Allow your IP (if required)

Some Aiven configurations restrict network access. If connections time out:

1. Open the service in the console.
2. Check **Allowed IP addresses** / network settings.
3. Add your current public IP, or temporarily allow broader access for development (tighten later).

Render's outbound IPs are not fixed on free tier, so for this class project it is common to allow broader access while learning, and lock things down for production-grade work later.

---

## 7. Schema and seed data

Keep SQL in files under `sql/` so you can re-run it, review it in Git, and reuse it in Parts II and III.

### 7.1 `sql/schema.sql`

```sql
-- ShopTrack schema (MySQL 8+)
-- Safe to re-run for class demos: drops existing tables first.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS customers;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE categories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE products (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_id INT UNSIGNED NOT NULL,
  sku VARCHAR(32) NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  price DECIMAL(10, 2) NOT NULL,
  stock_qty INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_sku (sku),
  KEY idx_products_category (category_id),
  CONSTRAINT fk_products_category
    FOREIGN KEY (category_id) REFERENCES categories (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE customers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  city VARCHAR(100) NULL,
  country VARCHAR(100) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_customers_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE orders (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id INT UNSIGNED NOT NULL,
  status ENUM('pending', 'paid', 'shipped', 'cancelled', 'refunded')
    NOT NULL DEFAULT 'pending',
  ordered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (id),
  KEY idx_orders_customer (customer_id),
  KEY idx_orders_status (status),
  CONSTRAINT fk_orders_customer
    FOREIGN KEY (customer_id) REFERENCES customers (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_order_items_order (order_id),
  KEY idx_order_items_product (product_id),
  CONSTRAINT fk_order_items_order
    FOREIGN KEY (order_id) REFERENCES orders (id),
  CONSTRAINT fk_order_items_product
    FOREIGN KEY (product_id) REFERENCES products (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 7.2 `sql/seed.sql`

```sql
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
```

Note: `orders.total_amount` matches the sum of each order's line items in this seed set. In Part II you can recompute totals from `order_items` with joins and `SUM` as a consistency check.

### 7.3 Runners: apply SQL from Node

**`src/db/run-schema.js`**

```js
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../config');

async function main() {
  const sqlPath = path.join(__dirname, '../../sql/schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    ssl: config.db.ssl,
    multipleStatements: true,
  });

  try {
    console.log('Applying schema...');
    await connection.query(sql);
    console.log('Schema applied successfully.');
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

**`src/db/run-seed.js`**

```js
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../config');

async function main() {
  const sqlPath = path.join(__dirname, '../../sql/seed.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    ssl: config.db.ssl,
    multipleStatements: true,
  });

  try {
    console.log('Seeding data...');
    await connection.query(sql);
    console.log('Seed data loaded successfully.');
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Apply schema and seed:

```bash
npm run db:reset
```

If something fails, read the error carefully. Common issues:

- Wrong host/port/password
- Missing or wrong CA path
- IP not allowed on Aiven
- SSL required but not configured

---

## 8. Connect to MySQL from the CLI

Using values from `.env` (or the Aiven Overview page):

```bash
mysql \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --user="$DB_USER" \
  --password="$DB_PASSWORD" \
  --database="$DB_NAME" \
  --ssl-mode=REQUIRED \
  --ssl-ca=./certs/ca.pem
```

If your shell does not export those variables, paste the values literally once:

```bash
mysql \
  --host=shoptrack-mysql-....aivencloud.com \
  --port=12345 \
  --user=avnadmin \
  --password='your-password' \
  --database=defaultdb \
  --ssl-mode=REQUIRED \
  --ssl-ca=./certs/ca.pem
```

Quick checks:

```sql
SHOW TABLES;
SELECT COUNT(*) FROM products;
SELECT p.name, c.name AS category
FROM products p
JOIN categories c ON c.id = p.category_id
LIMIT 5;
```

You can also apply SQL files directly:

```bash
mysql ...options... < sql/schema.sql
mysql ...options... < sql/seed.sql
```

---

## 9. Connect from VS Code

Two common approaches:

### 9.1 Database Client / MySQL extension

1. Install an extension such as **Database Client** (WeChat), **MySQL** (by Jun Han), or **SQLTools** + **SQLTools MySQL/MariaDB**.
2. Create a new connection:
   - Host / Port / User / Password / Database from Aiven
   - Enable SSL
   - Point **CA certificate** to `certs/ca.pem` when the UI allows it
3. Test the connection, then browse tables and run queries in a SQL notebook or query tab.

### 9.2 Keep credentials out of workspace settings

Do not commit connection passwords in `.vscode/settings.json`. Use the extension's secret storage, or paste credentials only into the connection UI.

For class demos, many instructors use the CLI for schema changes and VS Code for exploratory SELECT practice in Part II.

---

## 10. Run the API locally

```bash
npm start
# or
npm run dev
```

In another terminal:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/products
curl http://localhost:3000/api/customers/1/profile
```

You should see JSON that includes database time on `/health` and product rows on `/api/products`.

---

## 11. Put the project on GitHub

### 11.1 First commit

```bash
git init
git add .
git status   # confirm .env and certs/*.pem are NOT staged
git commit -m "Initial ShopTrack API with schema, seed, and Express routes"
```

If `.env` appears in `git status` as staged, unstage it and fix `.gitignore` before committing:

```bash
git rm --cached .env
```

### 11.2 Create a GitHub repo

Using the GitHub website:

1. New repository → name it `shoptrack-api` (public or private).
2. Do **not** initialize with a README if you already have a local project.
3. Connect and push:

```bash
git branch -M main
git remote add origin git@github.com:YOUR_GITHUB_USER/shoptrack-api.git
# or HTTPS:
# git remote add origin https://github.com/YOUR_GITHUB_USER/shoptrack-api.git

git push -u origin main
```

Using GitHub CLI (if installed):

```bash
gh repo create shoptrack-api --private --source=. --remote=origin --push
```

---

## 12. Deploy to Render

### 12.1 Create a Web Service (dashboard)

1. Open [https://dashboard.render.com](https://dashboard.render.com).
2. **New** → **Web Service**.
3. Connect your GitHub account if needed, then select the `shoptrack-api` repository.
4. Configure:

| Setting | Value |
|---------|--------|
| Name | `shoptrack-api` (or similar) |
| Language / Runtime | Node |
| Branch | `main` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance type | **Free** |

5. Add **Environment Variables** (same names as `.env`, values from Aiven):

| Key | Value |
|-----|--------|
| `NODE_ENV` | `production` |
| `DB_HOST` | your Aiven host |
| `DB_PORT` | your Aiven port |
| `DB_USER` | your Aiven user |
| `DB_PASSWORD` | your Aiven password |
| `DB_NAME` | `defaultdb` (or your DB name) |
| `DB_SSL` | `true` |

**About the CA certificate on Render:** free web services do not ship your local `certs/ca.pem` unless you commit it. Two practical class options:

**Option A (simplest for class):** set `DB_SSL=true` and rely on the fallback in `config.js` (`rejectUnauthorized: false`). Traffic is still encrypted with TLS.

**Option B (better verification):** commit `certs/ca.pem` (it is a CA certificate, not your database password), set `DB_SSL_CA=./certs/ca.pem` on Render, and keep passwords only in environment variables.

6. Click **Create Web Service** and wait for the first deploy.

### 12.2 Verify production

Render assigns a URL like:

```text
https://shoptrack-api.onrender.com
```

Test:

```bash
curl https://shoptrack-api.onrender.com/health
curl https://shoptrack-api.onrender.com/api/products
```

**Free tier behavior:** the service may sleep after inactivity. The first request after sleep can take about 30 to 60 seconds. That is expected, not necessarily a broken deploy.

### 12.3 Auto-deploys from Git

By default, pushes to the connected branch trigger a new deploy:

```bash
# after a code change
git add .
git commit -m "Improve products route error handling"
git push origin main
```

Watch the deploy logs in the Render dashboard.

### 12.4 Optional: Render CLI

After `render login`:

```bash
render services
render deploys list
render deploys create
render logs
```

Useful when you want to trigger a redeploy or inspect logs without leaving the terminal.

You can also define infrastructure as code later with a `render.yaml` Blueprint. For Part I, the dashboard flow is enough.

---

## 13. Optional: local MySQL for offline SQL practice

You do not need a local server if Aiven is always available. For flights, offline homework, or heavier experimentation:

```bash
# macOS example
brew install mysql
brew services start mysql
mysql -u root
```

```sql
CREATE DATABASE shoptrack;
CREATE USER 'shoptrack'@'localhost' IDENTIFIED BY 'localdev';
GRANT ALL ON shoptrack.* TO 'shoptrack'@'localhost';
FLUSH PRIVILEGES;
```

Point a second env file (for example `.env.local`) at localhost **without** SSL, run `npm run db:reset`, and practice SQL. Keep production still on Aiven.

---

## 14. Security checklist (do this before you share screenshots)

- [ ] `.env` is not in Git
- [ ] Database password is only in local `.env` and Render environment settings
- [ ] GitHub repo does not contain real Aiven passwords in README screenshots
- [ ] You understand free-tier sleep and storage limits
- [ ] You can connect with either CLI or VS Code for Part II

If you accidentally committed a secret:

1. Rotate the password in the Aiven console immediately.
2. Remove the secret from Git history (or treat the repo as compromised and start clean for class).
3. Update Render env vars to the new password.

---

## 15. Troubleshooting

| Symptom | Likely cause | What to try |
|---------|----------------|-------------|
| `Missing required environment variable` | `.env` not loaded or empty key | Confirm file name is `.env` in project root; restart the process |
| `ECONNREFUSED` / timeout | Wrong host/port, or IP blocked | Re-copy Aiven connection info; check allowed IPs |
| SSL / certificate errors | Missing CA or SSL flags | Set `DB_SSL_CA` correctly, or `DB_SSL=true` for the class fallback |
| `/health` fails on Render but works locally | Env vars not set on Render | Compare local `.env` keys with Render Environment tab |
| Deploy succeeds but app crashes on boot | `required()` throws for missing DB vars | Read Render logs; add missing variables; redeploy |
| Empty product list | Schema/seed never applied to this database | Run `npm run db:reset` against the Aiven DB from your laptop |
| First request after idle is slow | Free tier spin-down | Wait; subsequent requests should be fast |

---

## 16. What you should have now

- [x] Node/Express project with a clean folder layout
- [x] MySQL schema + seed scripts under version control
- [x] Aiven MySQL service with seed data loaded
- [x] Local API verified with `/health` and `/api/products`
- [x] GitHub repository connected to Render
- [x] Production API URL responding
- [x] A path to query MySQL (CLI and/or VS Code)

That is the baseline for the SQL-focused parts of the series.

