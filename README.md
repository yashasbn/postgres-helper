# PostgreSQL Connectivity Helper 🐘🔌

![Node.js](https://img.shields.io/badge/Node.js-v18+-green?logo=node.js)
![Vue.js](https://img.shields.io/badge/Vue.js-3.x-4FC08D?logo=vue.js)
![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Ready-336791?logo=postgresql)

A lightweight, modern web utility designed to test connection parameters to PostgreSQL databases, fetch server-level metrics, discover schemas, and retrieve schema-level performance and table/index statistics.

---

## 📖 Table of Contents

- [Architecture](#-architecture)
- [Key Features](#-key-features)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration](#configuration)
- [Running the Application](#-running-the-application)
- [API Reference](#-api-reference)
- [Running Tests](#-running-tests)
- [License](#-license)

---

## 🏗 Architecture

This project is split into two primary components:
1. **Backend**: A Node.js + Express application that communicates with PostgreSQL databases using `pg`, collects performance metrics, and supports Prometheus metrics export.
2. **Frontend**: A sleek, custom-styled dashboard built using Vite, Vue 3, Vue Router, and Pinia for state management.

---

## ✨ Key Features

- **PostgreSQL Connectivity Verification**: Test connection parameters dynamically (host, port, user, password, database, SSL mode, and timeout).
- **Server Metrics Dashboard**: Collect extensions, active/idle connections, lock stats, temporary file usage, bgwriter/WAL statistics, and slow queries (`pg_stat_statements`).
- **Schema Analyzer**: Discover databases and schemas dynamically to view table stats (live/dead tuples, sequential/index scans, sizes) and index-level details.
- **Dynamic Credentials**: The application does not rely on hardcoded environment variables for passwords; credentials are passed dynamically and securely per session.
- **Rate Limiting**: Built-in API protection via `express-rate-limit`.
- **Prometheus Exporter**: Serves metrics on standard `/prometheus` endpoints for system monitoring.

---

## 📂 Project Structure

```text
postgres-helper/
├── frontend/                 # Vue 3 + Vite Frontend
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── router/           # Vue Router configuration
│   │   ├── services/         # API integration methods
│   │   ├── store/            # Pinia state management
│   │   └── views/            # Dashboard and Connectivity Views
│   └── vite.config.ts        # Vite configuration & proxy settings
├── src/                      # Node.js Express Backend
│   ├── routes/               # API route definitions (connectivity.js)
│   ├── middleware/           # Rate limiters and security middleware
│   └── app.js                # Express app setup
├── test/                     # Jest Integration Tests
└── index.js                  # Backend Entry Point
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18 or later recommended.
- **npm**: v9 or later.
- **PostgreSQL**: Access to a target database to test against.

### Installation

1. Clone or download the repository contents.
2. Install dependencies for the backend:
   ```bash
   npm install
   ```
3. Install dependencies for the frontend:
   ```bash
   cd frontend
   npm install
   ```

### Configuration

Create a `.env` file in the backend root directory (based on `.env.sample`). 
*Note: Passwords are provided directly through the UI, so `CONNECTIVITY_DEFAULT_PASSWORD` is optional.*

```env
PORT=8080
METRICS_PORT=44420
CORS_ORIGIN=http://localhost:3000
API_RATE_LIMIT_WINDOW_MS=900000
API_RATE_LIMIT_MAX=1000
```

---

## 💻 Running the Application

### 1. Start the Backend Server

From the `postgres-helper` root directory:
```bash
node src/index.js
```
The backend will run on port `8080` (API) and port `44420` (Prometheus metrics/health).

### 2. Start the Frontend Development Server

Open a new terminal window, navigate to the `frontend` directory, and run:
```bash
npm run dev
```
The Vite development server will start on `http://localhost:3000/` and automatically proxy `/api` requests to the backend server.

---

## 🔌 API Reference

The backend provides several core endpoints:

- `POST /api/connectivity-test`: Validates standard connection parameters and returns basic host details.
- `POST /api/postgres-metrics`: Fetches deep server-level statistics, locks, and active sessions.
- `POST /api/postgres-schemas`: Discovers available databases and enumerates schemas.
- `POST /api/postgres-schema-metrics`: Fetches detailed table and index statistics for a specific schema.
- `GET /health`: Basic health check endpoint.
- `GET /prometheus`: Exports application metrics for Prometheus scraping.

---

## 🧪 Running Tests

To run the backend integration and validation tests using Jest:
```bash
npm test
```

---

## 📝 License

This project is licensed under the MIT License.
