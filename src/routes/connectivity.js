import { Router } from 'express';
import pg from 'pg';
import { connectivityTestLimiter } from '../middleware/rateLimiter.js';

const { Client } = pg;
const router = Router();

const SUPPORTED_SSL_MODES = new Set(['disable', 'require', 'verify-ca', 'verify-full']);
const DEFAULT_SERVER_HOST = 'localhost';

function getSslConfig(sslmode, host) {
  switch (sslmode) {
    case 'disable':
      return false;
    case 'require':
      return { rejectUnauthorized: false };
    case 'verify-ca': {
      const ca = process.env.DB_CA_CERT;
      if (!ca) {
        throw new Error('DB_CA_CERT env var is required for sslmode=verify-ca');
      }
      return { rejectUnauthorized: true, ca };
    }
    case 'verify-full': {
      const ca = process.env.DB_CA_CERT;
      if (!ca) {
        throw new Error('DB_CA_CERT env var is required for sslmode=verify-full');
      }
      return { rejectUnauthorized: true, ca, servername: host };
    }
    default:
      throw new Error(`Unsupported sslmode: ${sslmode}`);
  }
}

async function querySafe(dbClient, query, params = []) {
  try {
    const result = await dbClient.query(query, params);
    return { ok: true, rows: result.rows };
  } catch (err) {
    return { ok: false, error: err.message || 'Query failed' };
  }
}

router.post('/api/connectivity-test', connectivityTestLimiter, async (req, res) => {
  const {
    host = 'localhost',
    port = 5432,
    database,
    user,
    password: bodyPassword,
    sslmode = 'require',
    connectTimeoutMs = 7000,
  } = req.body || {};

  const password = bodyPassword || process.env.CONNECTIVITY_DEFAULT_PASSWORD;

  if (!database || !user) {
    return res.status(400).json({
      ok: false,
      error: 'database and user are required',
    });
  }

  const parsedPort = Number(port);
  const parsedTimeout = Number(connectTimeoutMs);

  if (!Number.isInteger(parsedPort) || parsedPort <= 0 || parsedPort > 65535) {
    return res.status(400).json({
      ok: false,
      error: 'port must be an integer between 1 and 65535',
    });
  }

  if (!Number.isInteger(parsedTimeout) || parsedTimeout < 1000 || parsedTimeout > 30000) {
    return res.status(400).json({
      ok: false,
      error: 'connectTimeoutMs must be an integer between 1000 and 30000',
    });
  }

  if (!SUPPORTED_SSL_MODES.has(sslmode)) {
    return res.status(400).json({
      ok: false,
      error: `Invalid sslmode: ${sslmode}. Allowed values: disable, require, verify-ca, verify-full`,
    });
  }

  if (!password) {
    return res.status(400).json({
      ok: false,
      error: 'Password is required',
    });
  }

  let ssl;
  try {
    ssl = getSslConfig(sslmode, host);
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || 'Invalid SSL configuration',
    });
  }

  const dbClient = new Client({
    host,
    port: parsedPort,
    database,
    user,
    password,
    ssl,
    connectionTimeoutMillis: parsedTimeout,
  });

  const startedAt = Date.now();

  try {
    await dbClient.connect();
    const result = await dbClient.query(`
      SELECT
        current_database() AS database_name,
        current_user AS user_name,
        inet_server_addr()::text AS server_addr,
        inet_server_port() AS server_port,
        version() AS version
    `);
    const databaseSizeResult = await dbClient.query(`
      SELECT
        datname AS database_name,
        ROUND(pg_database_size(datname) / 1024.0 / 1024.0, 2) AS size_mb
      FROM pg_database
      WHERE datname NOT IN (
        'azure_sys',
        'azure_maintenance',
        'template0',
        'template1',
        'postgres'
      )
      ORDER BY pg_database_size(datname) DESC
    `);

    return res.status(200).json({
      ok: true,
      latencyMs: Date.now() - startedAt,
      details: {
        database: result.rows[0]?.database_name || database,
        user: result.rows[0]?.user_name || user,
        serverAddress: result.rows[0]?.server_addr || host,
        serverPort: result.rows[0]?.server_port || parsedPort,
        version: result.rows[0]?.version || 'unknown',
        databases: databaseSizeResult.rows.map((row) => ({
          name: row.database_name,
          sizeMb: Number(row.size_mb),
        })),
      },
    });
  } catch (err) {
    return res.status(502).json({
      ok: false,
      error: err.message || 'Failed to connect to PostgreSQL',
      code: err.code || 'UNKNOWN_ERROR',
    });
  } finally {
    await dbClient.end().catch(() => {});
  }
});

router.post('/api/postgres-metrics', connectivityTestLimiter, async (req, res) => {
  const {
    host = 'localhost',
    port = 5432,
    database,
    user,
    password: bodyPassword,
    sslmode = 'require',
    connectTimeoutMs = 7000,
  } = req.body || {};

  const password = bodyPassword || process.env.CONNECTIVITY_DEFAULT_PASSWORD;

  if (!database || !user) {
    return res.status(400).json({
      ok: false,
      error: 'database and user are required',
    });
  }

  if (!password) {
    return res.status(400).json({
      ok: false,
      error: 'Password is required',
    });
  }

  const parsedPort = Number(port);
  const parsedTimeout = Number(connectTimeoutMs);

  if (!Number.isInteger(parsedPort) || parsedPort <= 0 || parsedPort > 65535) {
    return res.status(400).json({
      ok: false,
      error: 'port must be an integer between 1 and 65535',
    });
  }

  if (!Number.isInteger(parsedTimeout) || parsedTimeout < 1000 || parsedTimeout > 30000) {
    return res.status(400).json({
      ok: false,
      error: 'connectTimeoutMs must be an integer between 1000 and 30000',
    });
  }

  if (!SUPPORTED_SSL_MODES.has(sslmode)) {
    return res.status(400).json({
      ok: false,
      error: `Invalid sslmode: ${sslmode}. Allowed values: disable, require, verify-ca, verify-full`,
    });
  }

  let ssl;
  try {
    ssl = getSslConfig(sslmode, host);
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || 'Invalid SSL configuration',
    });
  }

  const dbClient = new Client({
    host,
    port: parsedPort,
    database,
    user,
    password,
    ssl,
    connectionTimeoutMillis: parsedTimeout,
  });

  const startedAt = Date.now();

  try {
    await dbClient.connect();

    // Run all queries sequentially to avoid parallel queries on the same client
    const serverInfo = await querySafe(
      dbClient,
      `
        SELECT
          version() AS version,
          current_database() AS database_name,
          current_user AS user_name,
          inet_server_addr()::text AS server_addr,
          inet_server_port() AS server_port,
          now() AS server_time
      `
    );
    const extensions = await querySafe(
      dbClient,
      `
        SELECT extname, extversion
        FROM pg_extension
        ORDER BY extname
      `
    );
    const connectionStats = await querySafe(
      dbClient,
      `
        SELECT
          count(*) FILTER (WHERE state = 'active') AS active_connections,
          count(*) FILTER (WHERE state = 'idle') AS idle_connections,
          count(*) AS total_connections,
          current_setting('max_connections')::int AS max_connections
        FROM pg_stat_activity
      `
    );
    const dbStats = await querySafe(
      dbClient,
      `
        SELECT
          datname,
          numbackends,
          xact_commit,
          xact_rollback,
          blks_read,
          blks_hit,
          tup_returned,
          tup_fetched,
          tup_inserted,
          tup_updated,
          tup_deleted,
          conflicts,
          temp_files,
          temp_bytes,
          deadlocks,
          blk_read_time,
          blk_write_time,
          stats_reset
        FROM pg_stat_database
        ORDER BY datname
      `
    );
    const bgwriterStats = await querySafe(dbClient, `SELECT * FROM pg_stat_bgwriter`);
    const walStats = await querySafe(dbClient, `SELECT * FROM pg_stat_wal`);
    const lockStats = await querySafe(
      dbClient,
      `
        SELECT mode, granted, count(*) AS count
        FROM pg_locks
        GROUP BY mode, granted
        ORDER BY mode, granted
      `
    );
    const longRunning = await querySafe(
      dbClient,
      `
        SELECT
          pid,
          usename,
          datname,
          client_addr::text,
          state,
          now() - query_start AS duration,
          left(query, 300) AS query
        FROM pg_stat_activity
        WHERE state = 'active'
          AND query NOT ILIKE '%pg_stat_activity%'
        ORDER BY query_start ASC
        LIMIT 20
      `
    );
    const sizeStats = await querySafe(
      dbClient,
      `
        SELECT
          datname AS database_name,
          ROUND(pg_database_size(datname) / 1024.0 / 1024.0, 2) AS size_mb
        FROM pg_database
        ORDER BY pg_database_size(datname) DESC
      `
    );
    const waitEventStats = await querySafe(
      dbClient,
      `
        SELECT
          COALESCE(wait_event_type, 'CPU') AS wait_event_type,
          COALESCE(wait_event, 'on_cpu') AS wait_event,
          count(*) AS sessions
        FROM pg_stat_activity
        WHERE state = 'active'
        GROUP BY COALESCE(wait_event_type, 'CPU'), COALESCE(wait_event, 'on_cpu')
        ORDER BY sessions DESC, wait_event_type, wait_event
        LIMIT 20
      `
    );
    const blockingStats = await querySafe(
      dbClient,
      `
        SELECT
          pid AS blocked_pid,
          usename,
          datname,
          age(now(), query_start) AS blocked_duration,
          cardinality(pg_blocking_pids(pid)) AS blocker_count,
          pg_blocking_pids(pid) AS blocker_pids,
          left(query, 200) AS blocked_query
        FROM pg_stat_activity
        WHERE cardinality(pg_blocking_pids(pid)) > 0
        ORDER BY blocked_duration DESC
        LIMIT 20
      `
    );
    const tableChurnStats = await querySafe(
      dbClient,
      `
        SELECT
          schemaname,
          relname,
          n_live_tup,
          n_dead_tup,
          ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_tuple_pct,
          seq_scan,
          idx_scan,
          n_tup_ins,
          n_tup_upd,
          n_tup_del,
          autovacuum_count,
          autoanalyze_count
        FROM pg_stat_user_tables
        ORDER BY n_dead_tup DESC
        LIMIT 20
      `
    );
    const tempUsageStats = await querySafe(
      dbClient,
      `
        SELECT
          datname,
          temp_files,
          temp_bytes,
          pg_size_pretty(temp_bytes) AS temp_size
        FROM pg_stat_database
        WHERE temp_bytes > 0
        ORDER BY temp_bytes DESC
        LIMIT 20
      `
    );

    const hasPgStatStatements =
      extensions.ok && extensions.rows.some((row) => row.extname === 'pg_stat_statements');

    let pgStatStatements = { ok: false, error: 'pg_stat_statements extension is not enabled' };
    if (hasPgStatStatements) {
      pgStatStatements = await querySafe(
        dbClient,
        `
          SELECT
            queryid,
            calls,
            total_exec_time,
            mean_exec_time,
            rows,
            shared_blks_hit,
            shared_blks_read,
            temp_blks_read,
            temp_blks_written,
            left(query, 500) AS query
          FROM pg_stat_statements
          ORDER BY total_exec_time DESC
          LIMIT 25
        `
      );
    }

    return res.status(200).json({
      ok: true,
      latencyMs: Date.now() - startedAt,
      target: {
        host,
        port: parsedPort,
        database,
        user,
        sslmode,
      },
      metrics: {
        serverInfo,
        extensions,
        connectionStats,
        dbStats,
        bgwriterStats,
        walStats,
        lockStats,
        longRunning,
        sizeStats,
        waitEventStats,
        blockingStats,
        tableChurnStats,
        tempUsageStats,
        pgStatStatements,
      },
    });
  } catch (err) {
    return res.status(502).json({
      ok: false,
      error: err.message || 'Failed to fetch PostgreSQL metrics',
      code: err.code || 'UNKNOWN_ERROR',
    });
  } finally {
    await dbClient.end().catch(() => {});
  }
});

router.post('/api/postgres-schemas', connectivityTestLimiter, async (req, res) => {
  const {
    host = 'localhost',
    port = 5432,
    database,
    user,
    password: bodyPassword,
    sslmode = 'require',
    connectTimeoutMs = 7000,
  } = req.body || {};

  const password = bodyPassword || process.env.CONNECTIVITY_DEFAULT_PASSWORD;

  if (!user) {
    return res.status(400).json({
      ok: false,
      error: 'user is required',
    });
  }

  if (!password) {
    return res.status(400).json({
      ok: false,
      error: 'Password is required',
    });
  }

  const parsedPort = Number(port);
  const parsedTimeout = Number(connectTimeoutMs);

  if (!Number.isInteger(parsedPort) || parsedPort <= 0 || parsedPort > 65535) {
    return res.status(400).json({
      ok: false,
      error: 'port must be an integer between 1 and 65535',
    });
  }

  if (!Number.isInteger(parsedTimeout) || parsedTimeout < 1000 || parsedTimeout > 30000) {
    return res.status(400).json({
      ok: false,
      error: 'connectTimeoutMs must be an integer between 1000 and 30000',
    });
  }

  if (!SUPPORTED_SSL_MODES.has(sslmode)) {
    return res.status(400).json({
      ok: false,
      error: `Invalid sslmode: ${sslmode}. Allowed values: disable, require, verify-ca, verify-full`,
    });
  }

  let ssl;
  try {
    ssl = getSslConfig(sslmode, host);
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || 'Invalid SSL configuration',
    });
  }

  const startedAt = Date.now();
  let selectedDatabase = database;
  let dbClient;

  try {
    if (!selectedDatabase || selectedDatabase === 'postgres') {
      const discoveryClient = new Client({
        host,
        port: parsedPort,
        database: 'postgres',
        user,
        password,
        ssl,
        connectionTimeoutMillis: parsedTimeout,
      });

      try {
        await discoveryClient.connect();
        const discoveryResult = await querySafe(
          discoveryClient,
          `
            SELECT datname AS database_name
            FROM pg_database
            WHERE datname NOT IN (
              'azure_sys',
              'azure_maintenance',
              'template0',
              'template1',
              'postgres'
            )
            ORDER BY datname
            LIMIT 1
          `
        );

        if (!discoveryResult.ok || !discoveryResult.rows?.length) {
          return res.status(404).json({
            ok: false,
            error: 'No non-postgres databases found to fetch schemas from',
          });
        }

        selectedDatabase = discoveryResult.rows[0].database_name;
      } finally {
        await discoveryClient.end().catch(() => {});
      }
    }

    dbClient = new Client({
      host,
      port: parsedPort,
      database: selectedDatabase,
      user,
      password,
      ssl,
      connectionTimeoutMillis: parsedTimeout,
    });

    await dbClient.connect();

    // Fetch all schemas
    const schemasResult = await querySafe(
      dbClient,
      `
        SELECT
          nspname AS schema_name,
          nspowner::regrole AS owner,
          (
            SELECT count(*)
            FROM pg_class c
            WHERE c.relnamespace = pg_namespace.oid AND c.relkind = 'r'
          ) AS table_count,
          (
            SELECT count(*)
            FROM pg_class c
            WHERE c.relnamespace = pg_namespace.oid AND c.relkind = 'i'
          ) AS index_count,
          pg_catalog.obj_description(pg_namespace.oid, 'pg_namespace') AS description
        FROM pg_namespace
        WHERE nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
        ORDER BY nspname
      `
    );

    return res.status(200).json({
      ok: true,
      latencyMs: Date.now() - startedAt,
      database: selectedDatabase,
      schemas: schemasResult.ok ? schemasResult.rows : [],
      error: schemasResult.error || null,
    });
  } catch (err) {
    return res.status(502).json({
      ok: false,
      error: err.message || 'Failed to fetch schemas',
      code: err.code || 'UNKNOWN_ERROR',
    });
  } finally {
    if (dbClient) {
      await dbClient.end().catch(() => {});
    }
  }
});

router.post('/api/postgres-schema-metrics', connectivityTestLimiter, async (req, res) => {
  const {
    host = 'localhost',
    port = 5432,
    database,
    schema = 'public',
    user,
    password: bodyPassword,
    sslmode = 'require',
    connectTimeoutMs = 7000,
  } = req.body || {};

  const password = bodyPassword || process.env.CONNECTIVITY_DEFAULT_PASSWORD;

  if (!database || !user) {
    return res.status(400).json({
      ok: false,
      error: 'database and user are required',
    });
  }

  if (!password) {
    return res.status(400).json({
      ok: false,
      error: 'Password is required',
    });
  }

  const parsedPort = Number(port);
  const parsedTimeout = Number(connectTimeoutMs);

  if (!Number.isInteger(parsedPort) || parsedPort <= 0 || parsedPort > 65535) {
    return res.status(400).json({
      ok: false,
      error: 'port must be an integer between 1 and 65535',
    });
  }

  if (!Number.isInteger(parsedTimeout) || parsedTimeout < 1000 || parsedTimeout > 30000) {
    return res.status(400).json({
      ok: false,
      error: 'connectTimeoutMs must be an integer between 1000 and 30000',
    });
  }

  if (!SUPPORTED_SSL_MODES.has(sslmode)) {
    return res.status(400).json({
      ok: false,
      error: `Invalid sslmode: ${sslmode}. Allowed values: disable, require, verify-ca, verify-full`,
    });
  }

  let ssl;
  try {
    ssl = getSslConfig(sslmode, host);
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || 'Invalid SSL configuration',
    });
  }

  const dbClient = new Client({
    host,
    port: parsedPort,
    database,
    user,
    password,
    ssl,
    connectionTimeoutMillis: parsedTimeout,
  });

  const startedAt = Date.now();

  try {
    await dbClient.connect();

    const [
      schemaInfo,
      tableStats,
      indexStats,
      waitEventStats,
      blockingStats,
      tempUsageStats,
    ] = await Promise.all([
      querySafe(
        dbClient,
        `
          SELECT
            nspname AS schema_name,
            nspowner::regrole AS owner,
            pg_catalog.obj_description(pg_namespace.oid, 'pg_namespace') AS description,
            (
              SELECT count(*)
              FROM pg_class c
              WHERE c.relnamespace = pg_namespace.oid AND c.relkind = 'r'
            ) AS table_count,
            (
              SELECT count(*)
              FROM pg_class c
              WHERE c.relnamespace = pg_namespace.oid AND c.relkind = 'i'
            ) AS index_count
          FROM pg_namespace
          WHERE nspname = $1
        `,
        [schema]
      ),
      querySafe(
        dbClient,
        `
          SELECT
            schemaname,
            relname,
            n_live_tup,
            n_dead_tup,
            ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_tuple_pct,
            seq_scan,
            idx_scan,
            n_tup_ins,
            n_tup_upd,
            n_tup_del,
            autovacuum_count,
            autoanalyze_count,
            ROUND(pg_total_relation_size(schemaname || '.' || relname) / 1024.0 / 1024.0, 2) AS size_mb
          FROM pg_stat_user_tables
          WHERE schemaname = $1
          ORDER BY n_dead_tup DESC
          LIMIT 50
        `,
        [schema]
      ),
      querySafe(
        dbClient,
        `
          SELECT
            schemaname,
            relname AS tablename,
            indexrelname AS indexname,
            idx_scan,
            idx_tup_read,
            idx_tup_fetch,
            pg_size_pretty(pg_relation_size(indexrelid)) AS size
          FROM pg_stat_user_indexes
          WHERE schemaname = $1
          ORDER BY idx_scan DESC
          LIMIT 30
        `,
        [schema]
      ),
      querySafe(
        dbClient,
        `
          SELECT
            COALESCE(wait_event_type, 'CPU') AS wait_event_type,
            COALESCE(wait_event, 'on_cpu') AS wait_event,
            count(*) AS sessions
          FROM pg_stat_activity
          WHERE state = 'active'
          GROUP BY COALESCE(wait_event_type, 'CPU'), COALESCE(wait_event, 'on_cpu')
          ORDER BY sessions DESC
          LIMIT 20
        `
      ),
      querySafe(
        dbClient,
        `
          SELECT
            pid AS blocked_pid,
            usename,
            age(now(), query_start) AS blocked_duration,
            cardinality(pg_blocking_pids(pid)) AS blocker_count,
            left(query, 200) AS blocked_query
          FROM pg_stat_activity
          WHERE cardinality(pg_blocking_pids(pid)) > 0
          ORDER BY blocked_duration DESC
          LIMIT 20
        `
      ),
      querySafe(
        dbClient,
        `
          SELECT
            datname,
            temp_files,
            temp_bytes,
            pg_size_pretty(temp_bytes) AS temp_size
          FROM pg_stat_database
          WHERE datname = $1 AND temp_bytes > 0
        `,
        [database]
      ),
    ]);

    return res.status(200).json({
      ok: true,
      latencyMs: Date.now() - startedAt,
      database,
      schema,
      metrics: {
        schemaInfo,
        tableStats,
        indexStats,
        waitEventStats,
        blockingStats,
        tempUsageStats,
      },
    });
  } catch (err) {
    return res.status(502).json({
      ok: false,
      error: err.message || 'Failed to fetch schema metrics',
      code: err.code || 'UNKNOWN_ERROR',
    });
  } finally {
    await dbClient.end().catch(() => {});
  }
});

export default router;

