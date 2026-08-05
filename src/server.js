const app = require('./app');
const config = require('./config');

app.listen(config.port, () => {
  console.log(`shoptrack-api listening on port ${config.port} (${config.env})`);
});