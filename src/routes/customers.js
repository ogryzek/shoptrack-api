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