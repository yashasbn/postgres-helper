import 'dotenv/config';
import app from './app.js';
import express from 'express';

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});

const port = process.env.PORT || 8080;
const metricsPort = process.env.METRICS_PORT || 44420;

// Main application server (API + frontend)
app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});

// Separate internal server for health checks and metrics (platform probes)
const metricsApp = express();

metricsApp.get('/health', (req, res) => {
  res.status(200).send('OK');
});

metricsApp.listen(metricsPort, () => {
  console.log(`Metrics and health listening on port ${metricsPort}`);
});
