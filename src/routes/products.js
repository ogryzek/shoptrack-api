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