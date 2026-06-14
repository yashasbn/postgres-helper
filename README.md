# PostgreSQL Connectivity Helper

A lightweight, modern web utility designed to test connection parameters to PostgreSQL databases, fetch server-level metrics, discover schemas, and retrieve schema-level performance and table/index statistics.

---

## Architecture

This project is split into two primary components:
1. **Backend**: Node.js + Express application that communicates with PostgreSQL databases, collects performance metrics, and supports Prometheus metrics export.
2. **Frontend**: A sleek, custom CSS dashboard built using Vite, Vue 3, Vue Router, and Pinia.

---

## Features

- **PostgreSQL Connectivity Verification**: Test connection parameters (host, port, user, password, database, SSL mode, and timeout).
- **Server Metrics Dashboard**: Collect extensions, active/idle connections, lock stats, temporary file usage, bgwriter/WAL statistics, and slow queries (`pg_stat_statements`).
- **Schema Analyzer**: Choose databases and schemas dynamically to view table stats (live/dead tuples, scans, sizes) and index-level details.
- **Rate Limiting**: Built-in protection for connectivity test API routes.
- **Prometheus Exporter**: Serves metrics on standard `/prometheus` endpoints for system monitoring.

---

## Getting Started

### Prerequisites

- **Node.js**: v18 or later recommended.
- **npm**: v9 or later.

### Installation

1. Clone or copy the repository contents.
2. Install dependencies in the backend root:
   ```bash
   npm install
   ```
3. Install dependencies in the frontend directory:
   ```bash
   cd frontend
   npm install
   ```

### Configuration

Create a `.env` file in the backend root directory (based on `.env.sample`):

```env
PORT=8080
METRICS_PORT=44420
CONNECTIVITY_DEFAULT_PASSWORD=your_default_password
CORS_ORIGIN=http://localhost:3000
API_RATE_LIMIT_WINDOW_MS=900000
API_RATE_LIMIT_MAX=1000
```

---

## Running the Application

### 1. Start the Backend Server

From the `postgres-helper` root directory:
```bash
node src/index.js
```
The backend will run on port `8080` (API) and port `44420` (Prometheus metrics/health).

### 2. Start the Frontend Development Server

From the `postgres-helper/frontend` directory:
```bash
npm run dev
```
The Vite development server will start on `http://localhost:3000/` and automatically proxy `/api` requests to the backend server.

---

## Running Tests

To run the backend integration and validation tests, run:
```bash
npm test
```
