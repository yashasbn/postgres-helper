<script setup lang="ts">
import { ref, computed } from "vue";
import { useConnectivityStore } from "@/store/connectivity";
import { storeToRefs } from "pinia";
import type { PostgresQueryBlock, PostgresSchemaMetricsPayload } from "@/types/connectivity";

const store = useConnectivityStore();
const { 
  loading, lastResult, error, metricsLoading, postgresMetrics, metricsError, 
  schemasLoading, postgresSchemas, schemasError,
  schemaMetricsLoading, postgresSchemaMetrics, schemaMetricsError
} = storeToRefs(store);

const DEFAULT_HOST = "localhost";
const DEFAULT_DATABASE = "postgres";
const DEFAULT_USER = "pgbigboss";

const host = ref(DEFAULT_HOST);
const port = ref(5432);
const database = ref(DEFAULT_DATABASE);
const user = ref(DEFAULT_USER);
const sslmode = ref("require");
const connectTimeoutMs = ref(7000);
const selectedSchema = ref("public");
const lastSchemaPayload = ref<PostgresSchemaMetricsPayload | null>(null);

const submitForm = async () => {
  await store.runConnectivityTest({
    host: host.value,
    port: Number(port.value),
    database: database.value,
    user: user.value,
    sslmode: sslmode.value as "disable" | "require",
    connectTimeoutMs: Number(connectTimeoutMs.value)
  });
};

const fetchMetrics = async () => {
  await store.runPostgresMetrics({
    host: host.value,
    port: Number(port.value),
    database: database.value,
    user: user.value,
    sslmode: sslmode.value as "disable" | "require",
    connectTimeoutMs: Number(connectTimeoutMs.value)
  });
};

const fetchSchemasAndMetrics = async () => {
  await store.runFetchSchemas({
    host: host.value,
    port: Number(port.value),
    database: database.value,
    user: user.value,
    sslmode: sslmode.value as "disable" | "require",
    connectTimeoutMs: Number(connectTimeoutMs.value)
  });

  // Auto-fetch metrics for selected schema using the discovered database
  const discoveredDb = store.postgresSchemas?.database || database.value;
  const payload: PostgresSchemaMetricsPayload = {
    host: host.value,
    port: Number(port.value),
    database: discoveredDb,
    schema: selectedSchema.value,
    user: user.value,
    sslmode: sslmode.value as "disable" | "require",
    connectTimeoutMs: Number(connectTimeoutMs.value)
  };

  lastSchemaPayload.value = payload;
  await store.runFetchSchemaMetrics(payload);
};

// Schema computed helpers
const availableSchemas = computed(() => postgresSchemas.value?.schemas ?? []);
const schemaMetrics = computed(() => postgresSchemaMetrics.value?.metrics);
const schemaInfo = computed(() => schemaMetrics.value?.schemaInfo?.rows?.[0] ?? null);
const tables = computed(() => (schemaMetrics.value?.tableStats?.rows ?? []) as Array<Record<string, unknown>>);
const indexes = computed(() => (schemaMetrics.value?.indexStats?.rows ?? []) as Array<Record<string, unknown>>);

const metricDescriptions: Record<string, string> = {
  schemaInfo: 'Schema metadata (owner, table/index counts)',
  tableStats: 'Table-level stats (live/dead tuples, scans, size)',
  indexStats: 'Index-level stats (scans, tuples read/fetched, size)',
  waitEventStats: 'Active session wait events (CPU, IO, Lock, etc.)',
  blockingStats: 'Sessions blocked by other sessions',
  tempUsageStats: 'Temporary file usage by the database',
};

const schemaMetricBlocks = computed(() => {
  const blocks = postgresSchemaMetrics.value?.metrics;
  if (!blocks) {
    return [];
  }

  return Object.entries(blocks).map(([name, block]) => {
    const typedBlock = block as PostgresQueryBlock;
    const rowCount = typedBlock?.rows?.length ?? 0;
    let summary = '';
    if (!typedBlock?.ok) {
      summary = 'Failed';
    } else if (rowCount === 0) {
      summary = 'No data';
    } else {
      summary = `${rowCount} row${rowCount > 1 ? 's' : ''} returned`;
    }
    return {
      name,
      ok: Boolean(typedBlock?.ok),
      rows: rowCount,
      summary,
      error: typedBlock?.error ?? null,
    };
  });
});

// --- Metrics computed helpers ---
const m = computed(() => postgresMetrics.value?.metrics);
const serverInfo = computed(() => (m.value?.serverInfo?.rows?.[0] ?? null) as Record<string, unknown> | null);
const extensions = computed(() => (m.value?.extensions?.rows ?? []) as Array<Record<string, unknown>>);
const connectionStats = computed(() => (m.value?.connectionStats?.rows ?? []) as Array<Record<string, unknown>>);
const sizeStats = computed(() => (m.value?.sizeStats?.rows ?? []) as Array<Record<string, unknown>>);
const lockStats = computed(() => (m.value?.lockStats?.rows ?? []) as Array<Record<string, unknown>>);
const waitEventStats = computed(() => (m.value?.waitEventStats?.rows ?? []) as Array<Record<string, unknown>>);
const blockingStats = computed(() => (m.value?.blockingStats?.rows ?? []) as Array<Record<string, unknown>>);
const tableChurnStats = computed(() => (m.value?.tableChurnStats?.rows ?? []) as Array<Record<string, unknown>>);
const tempUsageStats = computed(() => (m.value?.tempUsageStats?.rows ?? []) as Array<Record<string, unknown>>);
const bgwriter = computed(() => (m.value?.bgwriterStats?.rows?.[0] ?? null) as Record<string, unknown> | null);
const walStat = computed(() => (m.value?.walStats?.rows?.[0] ?? null) as Record<string, unknown> | null);
const longRunning = computed(() => (m.value?.longRunning?.rows ?? []) as Array<Record<string, unknown>>);
const topQueries = computed(() => {
  const block = m.value?.pgStatStatements;
  if (!block) return undefined;
  return block.ok ? ((block.rows ?? []) as Array<Record<string, unknown>>) : null;
});

const connActive = computed(() => connectionStats.value.find(r => r.state === 'active')?.count ?? 0);
const connIdle = computed(() => connectionStats.value.find(r => r.state === 'idle')?.count ?? 0);
const connTotal = computed(() => connectionStats.value.reduce((a, r) => a + Number(r.count), 0));

const fmtBytes = (bytes: number): string => {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return bytes + ' B';
};

const truncateQuery = (q: unknown, len = 140): string => {
  const s = String(q ?? '');
  return s.length > len ? s.slice(0, len) + '\u2026' : s;
};

const cacheHit = (row: Record<string, unknown>): string => {
  const hit = Number(row.shared_blks_hit);
  const read = Number(row.shared_blks_read);
  const total = hit + read;
  return total > 0 ? ((hit / total) * 100).toFixed(1) + '%' : 'N/A';
};

</script>

<template>
  <article class="grid">
    <h2 class="col-span-12">PostgreSQL Connectivity Test</h2>

    <div class="card col-span-12">
      <div class="card-heading">mds-col-span-12</div>
      <div class="card-body">
      <form class="grid" data-test="connectivity-form" @submit="submitForm">
        <div class="col-span-12">
          <div class="notification notification-info">
            User is fixed to <strong>{{ DEFAULT_USER }}</strong>, database is fixed to <strong>{{ DEFAULT_DATABASE }}</strong>,
            and password is applied server-side from <strong>CONNECTIVITY_DEFAULT_PASSWORD</strong>.
          </div>
        </div>

        <div class="form-group col-span-12">
            <label class="form-label">Host</label>
            <input
              type="text"
              class="form-input"
              :value="host"
              @input=""
              data-test="host-input"
              placeholder="localhost"
              name="host"
            />
          </div>

        <div class="form-group col-span-6">
            <label class="form-label">Port</label>
            <input
              type="number"
              class="form-input"
              :value="port"
              @input=""
              data-test="port-input"
              placeholder="5432"
              name="port"
            />
          </div>

        <div class="form-group col-span-6">
            <label class="form-label">Timeout (ms)</label>
            <input
              type="number"
              class="form-input"
              :value="connectTimeoutMs"
              @input=""
              data-test="timeout-input"
              placeholder="7000"
              name="connectTimeoutMs"
            />
          </div>

        <div class="col-span-12 button-row">
          <button
            type="button"
            class="btn"
            :disabled="loading"
            data-test="submit-button"
            @click=""
          >
            ▶ Test Connection
          </button>
          <button
            type="button"
            class="btn"
            :disabled="metricsLoading"
            data-test="metrics-button"
            @click=""
          >
            📊 Fetch Postgres Metrics
          </button>
          <button
            type="button"
            class="btn"
            :disabled="schemasLoading || schemaMetricsLoading"
            data-test="schemas-button"
            @click=""
          >
            📋 Fetch Schema Metrics
          </button>
        </div>
      </form>
    </div>
    </div>

    <div v-if="loading" class="col-span-12">
      <div class="loading"><div class="spinner"></div><span>Testing connectivity...</span></div>
    </div>

    <div
      v-if="lastResult?.ok"
      class="col-span-12 notification notification-success" data-test="success-notification"
    >
      <strong>Connection successful!</strong> Latency: {{ lastResult.latencyMs }}ms
    </div>

    <div
      v-if="error"
      class="col-span-12 notification notification-error" data-test="error-notification"
    >
      <strong>Connection failed:</strong> {{ error }}
    </div>

    <!-- Schema Selection Section -->
    <div v-if="schemasLoading" class="col-span-12">
      <div class="loading"><div class="spinner"></div><span>Fetching schemas...</span></div>
    </div>

    <div
      v-if="schemasError"
      class="col-span-12 notification notification-error"
    >
      <strong>Schemas fetch failed:</strong> {{ schemasError }}
    </div>

    <div v-if="postgresSchemas?.ok && availableSchemas.length" class="card col-span-12" data-test="schema-selector-card">
      <div class="card-heading">Select Schema</div>
      <div class="card-body">
      <div class="grid">
        <div class="col-span-6">
          <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 12px;">
            Schema
          </label>
          <select v-model="selectedSchema" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
            <option v-for="schema in availableSchemas" :key="schema.schema_name" :value="schema.schema_name">
              {{ schema.schema_name }} ({{ schema.table_count }} tables, {{ schema.index_count }} indexes)
            </option>
          </select>
        </div>
        <div class="col-span-6" style="display: flex; align-items: flex-end;">
          <button
            type="button"
            class="btn"
            :disabled="schemasLoading || schemaMetricsLoading"
            
            @click=""
          >
            📊 Refresh Schema Metrics
          </button>
        </div>
      </div>
    </div>
    </div>

    <!-- Schema Metrics Section -->
    <div v-if="schemaMetricsLoading" class="col-span-12">
      <div class="loading"><div class="spinner"></div><span>Fetching schema metrics...</span></div>
    </div>

    <div
      v-if="schemaMetricsError"
      class="col-span-12 notification notification-error"
    >
      <strong>Schema metrics fetch failed:</strong> {{ schemaMetricsError }}
    </div>

    <div
      v-if="postgresSchemaMetrics?.ok && schemaMetricBlocks.length"
      class="card col-span-12"
      data-test="schema-query-status-card"
    >
      <div class="card-heading">Schema Metrics Query Status — {{ postgresSchemaMetrics.schema || 'unknown' }}</div>
      <div class="card-body">
      <table class="metrics-table">
        <thead>
          <tr><th>Metric</th><th>Description</th><th>Result</th><th>Error</th></tr>
        </thead>
        <tbody>
          <tr v-for="block in schemaMetricBlocks" :key="block.name">
            <td>{{ block.name }}</td>
            <td class="metric-desc">{{ metricDescriptions[block.name] || '-' }}</td>
            <td :style="{ color: block.ok ? (block.rows > 0 ? 'green' : '#888') : 'red', fontWeight: 600 }">{{ block.summary }}</td>
            <td>{{ block.error || '-' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    </div>

    <template v-if="postgresSchemaMetrics?.ok && schemaInfo">
      <h2 class="col-span-12" style="margin-top: 24px;">Schema Metrics: {{ postgresSchemaMetrics.schema }}</h2>
      
      <div class="card col-span-6" data-test="schema-info-card">
      <div class="card-heading">mds-col-span-6</div>
      <div class="card-body">
        <div class="metrics-kv">
          <span class="kv-label">Schema</span>
          <span class="kv-value">{{ schemaInfo.schema_name }}</span>
          <span class="kv-label">Owner</span>
          <span class="kv-value">{{ schemaInfo.owner }}</span>
          <span class="kv-label">Tables</span>
          <span class="kv-value">{{ schemaInfo.table_count }}</span>
          <span class="kv-label">Indexes</span>
          <span class="kv-value">{{ schemaInfo.index_count }}</span>
        </div>
      </div>
    </div>

      <div class="card col-span-12" data-test="schema-tables-card">
      <div class="card-heading">mds-col-span-12</div>
      <div class="card-body">
        <table class="metrics-table" v-if="tables.length">
          <thead>
            <tr>
              <th>Table</th><th>Live Tuples</th><th>Dead Tuples</th><th>Dead %</th>
              <th>Seq Scans</th><th>Idx Scans</th><th>Size (MB)</th><th>Autovac</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in tables" :key="String(row.relname)">
              <td>{{ row.relname }}</td>
              <td>{{ Number(row.n_live_tup).toLocaleString() }}</td>
              <td>{{ Number(row.n_dead_tup).toLocaleString() }}</td>
              <td :style="{ color: Number(row.dead_tuple_pct) > 20 ? 'red' : 'inherit' }">
                {{ Number(row.dead_tuple_pct || 0).toFixed(2) }}%
              </td>
              <td>{{ Number(row.seq_scan).toLocaleString() }}</td>
              <td>{{ Number(row.idx_scan).toLocaleString() }}</td>
              <td>{{ Number(row.size_mb).toFixed(2) }}</td>
              <td>{{ Number(row.autovacuum_count).toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
        <span v-else class="empty-msg">No tables in this schema</span>
      </div>
    </div>

      <div v-if="indexes.length" class="card col-span-12" data-test="schema-indexes-card">
      <div class="card-heading">Indexes in Schema</div>
      <div class="card-body">
        <table class="metrics-table">
          <thead>
            <tr><th>Index</th><th>Table</th><th>Scans</th><th>Tuples Read</th><th>Tuples Fetched</th><th>Size</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in indexes" :key="String(row.indexname)">
              <td>{{ row.indexname }}</td>
              <td>{{ row.tablename }}</td>
              <td>{{ Number(row.idx_scan).toLocaleString() }}</td>
              <td>{{ Number(row.idx_tup_read).toLocaleString() }}</td>
              <td>{{ Number(row.idx_tup_fetch).toLocaleString() }}</td>
              <td>{{ row.size }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    </template>

    <div
      v-if="postgresSchemaMetrics && !postgresSchemaMetrics.ok"
      class="col-span-12 notification notification-error"
    >
      <strong>Schema metrics error:</strong> {{ postgresSchemaMetrics.error }}
    </div>

    <div v-if="metricsLoading" class="col-span-12">
      <div class="loading"><div class="spinner"></div><span>Fetching PostgreSQL metrics...</span></div>
    </div>

    <div
      v-if="metricsError"
      class="col-span-12 notification notification-error" data-test="metrics-error-notification"
    >
      <strong>Metrics fetch failed:</strong> {{ metricsError }}
    </div>

    <!-- PostgreSQL Metrics Dashboard -->
    <template v-if="postgresMetrics?.ok && postgresMetrics.metrics">

      <!-- Row 1: Server Info + Extensions -->
      <div class="card col-span-6" data-test="server-info-card">
      <div class="card-heading">mds-col-span-6</div>
      <div class="card-body">
        <div class="metrics-kv" v-if="serverInfo">
          <span class="kv-label">Version</span>
          <span class="kv-value">{{ String(serverInfo.version ?? '').split(' on ')[0] }}</span>
          <span class="kv-label">Server</span>
          <span class="kv-value">{{ serverInfo.inet_server_addr }}:{{ serverInfo.inet_server_port }}</span>
          <span class="kv-label">User</span>
          <span class="kv-value">{{ serverInfo.current_user }}</span>
          <span class="kv-label">Server Time</span>
          <span class="kv-value">{{ new Date(String(serverInfo.now)).toLocaleString() }}</span>
          <span class="kv-label">Latency</span>
          <span class="kv-value">{{ postgresMetrics.latencyMs }}ms</span>
        </div>
      </div>
    </div>

      <div class="card col-span-6" data-test="extensions-card">
      <div class="card-heading">mds-col-span-6</div>
      <div class="card-body">
        <div class="ext-list" v-if="extensions.length">
          <span v-for="ext in extensions" :key="String(ext.extname)" class="ext-chip">
            {{ ext.extname }}&nbsp;<em>v{{ ext.extversion }}</em>
          </span>
        </div>
        <span v-else class="empty-msg">No extensions found</span>
      </div>
    </div>

      <!-- Row 2: Connections + Lock Stats -->
      <div class="card col-span-6" data-test="connections-card">
      <div class="card-heading">mds-col-span-6</div>
      <div class="card-body">
        <div class="stat-trio">
          <div class="stat-block">
            <span class="stat-num stat-active">{{ connActive }}</span>
            <span class="stat-lbl">Active</span>
          </div>
          <div class="stat-block">
            <span class="stat-num">{{ connIdle }}</span>
            <span class="stat-lbl">Idle</span>
          </div>
          <div class="stat-block">
            <span class="stat-num">{{ connTotal }}</span>
            <span class="stat-lbl">Total</span>
          </div>
        </div>
        <table class="metrics-table" v-if="connectionStats.length">
          <thead><tr><th>State</th><th>Count</th></tr></thead>
          <tbody>
            <tr v-for="row in connectionStats" :key="String(row.state)">
              <td>{{ row.state || 'unknown' }}</td>
              <td>{{ row.count }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

      <div class="card col-span-6" data-test="lock-stats-card">
      <div class="card-heading">mds-col-span-6</div>
      <div class="card-body">
        <table class="metrics-table" v-if="lockStats.length">
          <thead><tr><th>Mode</th><th>Granted</th><th>Count</th></tr></thead>
          <tbody>
            <tr v-for="row in lockStats" :key="String(row.mode) + String(row.granted)">
              <td>{{ row.mode }}</td>
              <td>{{ row.granted }}</td>
              <td>{{ row.count }}</td>
            </tr>
          </tbody>
        </table>
        <span v-else class="empty-msg">No lock activity</span>
      </div>
    </div>

      <div class="card col-span-6" data-test="wait-events-card">
      <div class="card-heading">mds-col-span-6</div>
      <div class="card-body">
        <table class="metrics-table" v-if="waitEventStats.length">
          <thead><tr><th>Type</th><th>Event</th><th>Sessions</th></tr></thead>
          <tbody>
            <tr v-for="row in waitEventStats" :key="String(row.wait_event_type) + String(row.wait_event)">
              <td>{{ row.wait_event_type }}</td>
              <td>{{ row.wait_event }}</td>
              <td>{{ row.sessions }}</td>
            </tr>
          </tbody>
        </table>
        <span v-else class="empty-msg">No active waits captured</span>
      </div>
    </div>

      <div class="card col-span-6" data-test="blocked-sessions-card">
      <div class="card-heading">mds-col-span-6</div>
      <div class="card-body">
        <table class="metrics-table" v-if="blockingStats.length">
          <thead><tr><th>PID</th><th>Duration</th><th>Blockers</th><th>Query</th></tr></thead>
          <tbody>
            <tr v-for="row in blockingStats" :key="String(row.blocked_pid)">
              <td>{{ row.blocked_pid }}</td>
              <td>{{ row.blocked_duration }}</td>
              <td>{{ row.blocker_count }}</td>
              <td class="query-cell">{{ truncateQuery(row.blocked_query) }}</td>
            </tr>
          </tbody>
        </table>
        <span v-else class="empty-msg">No blocked sessions detected</span>
      </div>
    </div>

      <!-- Row 3: Database Sizes + Checkpointer/WAL -->
      <div class="card col-span-6" data-test="db-sizes-card">
      <div class="card-heading">mds-col-span-6</div>
      <div class="card-body">
        <table class="metrics-table" v-if="sizeStats.length">
          <thead><tr><th>Database</th><th>Size (MB)</th></tr></thead>
          <tbody>
            <tr v-for="row in sizeStats" :key="String(row.datname)">
              <td>{{ row.datname }}</td>
              <td>{{ Number(row.size_mb).toFixed(2) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

      <div class="card col-span-6" data-test="wal-card">
      <div class="card-heading">mds-col-span-6</div>
      <div class="card-body">
        <div class="metrics-kv">
          <template v-if="bgwriter">
            <span class="kv-label">Checkpoints (timed)</span>
            <span class="kv-value">{{ bgwriter.checkpoints_timed }}</span>
            <span class="kv-label">Checkpoints (req)</span>
            <span class="kv-value">{{ bgwriter.checkpoints_req }}</span>
            <span class="kv-label">Write Time</span>
            <span class="kv-value">{{ (Number(bgwriter.checkpoint_write_time) / 1000).toFixed(1) }}s</span>
            <span class="kv-label">Sync Time</span>
            <span class="kv-value">{{ (Number(bgwriter.checkpoint_sync_time) / 1000).toFixed(1) }}s</span>
          </template>
          <template v-if="walStat">
            <span class="kv-label">WAL Records</span>
            <span class="kv-value">{{ Number(walStat.wal_records).toLocaleString() }}</span>
            <span class="kv-label">WAL Size</span>
            <span class="kv-value">{{ fmtBytes(Number(walStat.wal_bytes)) }}</span>
          </template>
        </div>
      </div>
    </div>

      <!-- Long-Running Queries -->
      <div class="card col-span-12" data-test="long-running-card">
      <div class="card-heading">mds-col-span-12</div>
      <div class="card-body">
        <div v-if="!longRunning.length" class="empty-msg" style="color: green">No long-running queries detected.</div>
        <table class="metrics-table" v-else>
          <thead><tr><th>PID</th><th>Duration</th><th>State</th><th>Query</th></tr></thead>
          <tbody>
            <tr v-for="row in longRunning" :key="String(row.pid)">
              <td>{{ row.pid }}</td>
              <td>{{ row.duration }}</td>
              <td>{{ row.state }}</td>
              <td class="query-cell">{{ truncateQuery(row.query) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

      <div class="card col-span-12" data-test="table-churn-card">
      <div class="card-heading">mds-col-span-12</div>
      <div class="card-body">
        <table class="metrics-table" v-if="tableChurnStats.length">
          <thead>
            <tr>
              <th>Table</th><th>Dead Tuples</th><th>Dead %</th><th>Live Tuples</th>
              <th>Seq Scans</th><th>Idx Scans</th><th>Autovacuum</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in tableChurnStats" :key="String(row.schemaname) + '.' + String(row.relname)">
              <td>{{ row.schemaname }}.{{ row.relname }}</td>
              <td>{{ Number(row.n_dead_tup).toLocaleString() }}</td>
              <td>{{ Number(row.dead_tuple_pct || 0).toFixed(2) }}%</td>
              <td>{{ Number(row.n_live_tup).toLocaleString() }}</td>
              <td>{{ Number(row.seq_scan).toLocaleString() }}</td>
              <td>{{ Number(row.idx_scan).toLocaleString() }}</td>
              <td>{{ Number(row.autovacuum_count).toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
        <span v-else class="empty-msg">No table stats available</span>
      </div>
    </div>

      <div class="card col-span-12" data-test="temp-usage-card">
      <div class="card-heading">mds-col-span-12</div>
      <div class="card-body">
        <table class="metrics-table" v-if="tempUsageStats.length">
          <thead><tr><th>Database</th><th>Temp Files</th><th>Temp Bytes</th><th>Readable Size</th></tr></thead>
          <tbody>
            <tr v-for="row in tempUsageStats" :key="String(row.datname)">
              <td>{{ row.datname }}</td>
              <td>{{ Number(row.temp_files).toLocaleString() }}</td>
              <td>{{ Number(row.temp_bytes).toLocaleString() }}</td>
              <td>{{ row.temp_size }}</td>
            </tr>
          </tbody>
        </table>
        <span v-else class="empty-msg">No temp file usage recorded</span>
      </div>
    </div>

      <!-- Top Slow Queries -->
      <div v-if="topQueries && topQueries.length" class="card col-span-12"
        data-test="top-queries-card"
      >
      <div class="card-heading">Top Slow Queries (pg_stat_statements)</div>
      <div class="card-body">
        <div style="overflow-x: auto">
          <table class="metrics-table">
            <thead>
              <tr>
                <th>#</th><th>Calls</th><th>Total (ms)</th><th>Avg (ms)</th>
                <th>Rows</th><th>Cache Hit</th><th>Query</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in topQueries" :key="String(row.queryid)">
                <td>{{ i + 1 }}</td>
                <td>{{ Number(row.calls).toLocaleString() }}</td>
                <td>{{ Number(row.total_exec_time).toFixed(1) }}</td>
                <td>{{ Number(row.mean_exec_time).toFixed(2) }}</td>
                <td>{{ Number(row.rows).toLocaleString() }}</td>
                <td>{{ cacheHit(row) }}</td>
                <td class="query-cell">{{ truncateQuery(row.query) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

      <div
        v-if="topQueries === null"
        class="col-span-12 notification notification-info"
      >
        pg_stat_statements extension not available or not enabled.
      </div>

    </template>

    <div
      v-if="postgresMetrics && !postgresMetrics.ok"
      class="col-span-12 notification notification-error"
      data-test="metrics-failed-notification"
    >
      <strong>Metrics error:</strong> {{ postgresMetrics.error }}
    </div>

    <div v-if="lastResult?.ok && lastResult.details" class="card col-span-12"
      data-test="details-card"
    >
      <div class="card-heading">Connection Details</div>
      <div class="card-body">
      <div class="grid">
        <div class="col-span-6"><strong>Database:</strong> {{ lastResult.details.database }}</div>
        <div class="col-span-6"><strong>User:</strong> {{ lastResult.details.user }}</div>
        <div class="col-span-6"><strong>Server:</strong> {{ lastResult.details.serverAddress }}:{{ lastResult.details.serverPort }}</div>
        <div class="col-span-6"><strong>Latency:</strong> {{ lastResult.latencyMs }}ms</div>
        <div class="col-span-12"><strong>Version:</strong> {{ lastResult.details.version }}</div>
        <div class="col-span-12" v-if="lastResult.details.databases?.length">
          <strong>Databases:</strong>
          <ul>
            <li v-for="dbInfo in lastResult.details.databases" :key="dbInfo.name">
              {{ dbInfo.name }} - {{ dbInfo.sizeMb.toFixed(2) }} MB
            </li>
          </ul>
        </div>
      </div>
    </div>
    </div>
  </article>
</template>

<style scoped>
.metrics-kv {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 6px 16px;
  align-items: baseline;
}
.kv-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--clr-text-muted);
  white-space: nowrap;
}
.kv-value {
  font-size: 13px;
}
.metrics-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.metrics-table th {
  text-align: left;
  padding: 6px 8px;
  border-bottom: 2px solid var(--clr-border);
  font-weight: 600;
  white-space: nowrap;
}
.metrics-table td {
  padding: 5px 8px;
  border-bottom: 1px solid var(--clr-border-light);
  vertical-align: top;
}
.query-cell {
  font-family: monospace;
  font-size: 11px;
  max-width: 420px;
  word-break: break-all;
}
.stat-trio {
  display: flex;
  gap: 24px;
  margin-bottom: 14px;
}
.stat-block {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.stat-num {
  font-size: 30px;
  font-weight: 700;
  line-height: 1;
}
.stat-num.stat-active {
  color: var(--clr-primary);
}
.stat-lbl {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 2px;
  color: var(--clr-text-muted);
}
.ext-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.ext-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 12px;
  background: var(--clr-border-light);
  border: 1px solid var(--clr-border);
  font-size: 12px;
}
.ext-chip em {
  font-style: normal;
  color: var(--clr-text-muted);
}
.empty-msg {
  font-size: 13px;
  color: var(--clr-text-muted);
}
.json-block {
  margin-bottom: 12px;
}
.json-block pre {
  margin: 6px 0 0;
  padding: 10px;
  border-radius: 6px;
  background: var(--clr-border-light);
  border: 1px solid var(--clr-border);
  font-size: 12px;
  overflow-x: auto;
}
.status-legend {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 6px;
  background: var(--clr-border-light);
  font-size: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.metric-desc {
  font-size: 11px;
  color: var(--clr-text-muted);
}
.button-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
</style>
