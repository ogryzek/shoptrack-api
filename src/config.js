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
