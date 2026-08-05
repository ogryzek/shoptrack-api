# Full Stack MySQL Tutorial Series

**Stack:** Node.js, Express, MySQL  
**Hosting:** [Render](https://render.com) (web app)  
**Database:** [Aiven](https://aiven.io) (managed MySQL)

This series replaces the older Heroku + Git free-tier workflow. Heroku no longer offers a useful free tier for this kind of class project, so we use **Render** for the Node/Express service and **Aiven** for a free (or low-cost) managed MySQL database.

## Series outline

| Item | Title | Focus |
|------|--------|--------|
| [Part I](.Docs/part-1-setup-deploy.md) | Setup, Git, Deploy, Database | Scaffold the app, GitHub, Aiven MySQL, Render deploy, connect from VS Code / CLI |
| [Part II](.Docs/part-2-sql-fundamentals.md) | SQL Lab for Developers | SELECT, JOINs, aggregations, views for customer and admin dashboards, exercises |
| [Part III](.Docs/part-3-advanced-sql.md) | Advanced SQL | CTEs, more join patterns, window functions (outline) |
| [Reference app](./shoptrack-api/) | `shoptrack-api` | Ready-to-run Express + MySQL project matching Parts I and II |
| [Project assignment](./project-assignment.md) | Capstone project | Students apply Parts I and II on their own domain (**30 points**) |

## What you will build in the tutorials

A small **store API** (`shoptrack-api`) with:

- Customers, products, categories, orders, and order line items
- Seed data you can query immediately
- SQL views for customer profile and admin/analyst dashboards
- An Express API that talks to MySQL
- Deployment to Render with the database hosted on Aiven

Parts II and III use the same schema so you can practice SQL against real tables without inventing a new domain each time.

The **graded project** must use a **different domain** than ShopTrack. See the [project assignment](./project-assignment.md).

## Prerequisites (all parts)

- Node.js 20+ and npm
- Git
- A GitHub account
- A code editor (VS Code recommended)
- Free accounts on [Render](https://dashboard.render.com) and [Aiven](https://console.aiven.io)

Optional but useful:

- MySQL client CLI (`mysql`)
- [Aiven CLI](https://aiven.io/docs/tools/cli) (`avn`)
- [Render CLI](https://render.com/docs/cli) (`render`)
- VS Code **MySQL** or **Database Client** extension

## How to use this folder

1. Work through **[Part I](./part-1-setup-deploy.md)** (build from scratch) **or** clone/run the **[reference app](./shoptrack-api/)** and still read Part I for deploy and Aiven steps.
2. Complete the **[Part II SQL lab](./part-2-sql-fundamentals.md)** against the same database.
3. Complete the **[project assignment](./project-assignment.md)** on your own domain (30 points).
4. Optionally continue with [Part III](./part-3-advanced-sql.md).

## Reference app quick start

```bash
cd shoptrack-api
cp .env.example .env
# fill in Aiven credentials; add certs/ca.pem or set DB_SSL=true
npm install
npm run db:reset
npm start
```