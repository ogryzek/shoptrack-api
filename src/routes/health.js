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