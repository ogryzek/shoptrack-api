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
