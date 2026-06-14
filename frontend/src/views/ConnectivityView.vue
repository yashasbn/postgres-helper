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

// --- Form fields ---
const host = ref("localhost");
const port = ref(5432);
const database = ref("postgres");
const user = ref("");
const password = ref("");
const showPassword = ref(false);
const sslmode = ref<"disable" | "require">("require");
const connectTimeoutMs = ref(7000);
const selectedSchema = ref("public");
const lastSchemaPayload = ref<PostgresSchemaMetricsPayload | null>(null);

const getPayload = () => ({
  host: host.value,
  port: Number(port.value),
  database: database.value,
  user: user.value,
  password: password.value,
  sslmode: sslmode.value,
  connectTimeoutMs: Number(connectTimeoutMs.value),
});

const submitForm = async () => {
  await store.runConnectivityTest(getPayload());
};

const fetchMetrics = async () => {
  await store.runPostgresMetrics(getPayload());
};

const fetchSchemasAndMetrics = async () => {
  await store.runFetchSchemas(getPayload());
  const discoveredDb = store.postgresSchemas?.database || database.value;
  const payload: PostgresSchemaMetricsPayload = {
    ...getPayload(),
    database: discoveredDb,
    schema: selectedSchema.value,
  };
  lastSchemaPayload.value = payload;
  await store.runFetchSchemaMetrics(payload);
};

const refreshSchemaMetrics = async () => {
  if (!lastSchemaPayload.value) return;
  const payload: PostgresSchemaMetricsPayload = {
    ...lastSchemaPayload.value,
    schema: selectedSchema.value,
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
  if (!blocks) return [];
  return Object.entries(blocks).map(([name, block]) => {
    const typedBlock = block as PostgresQueryBlock;
    const rowCount = typedBlock?.rows?.length ?? 0;
    let summary = '';
    if (!typedBlock?.ok) summary = 'Failed';
    else if (rowCount === 0) summary = 'No data';
    else summary = `${rowCount} row${rowCount > 1 ? 's' : ''} returned`;
    return { name, ok: Boolean(typedBlock?.ok), rows: rowCount, summary, error: typedBlock?.error ?? null };
  });
});

// Metrics computed helpers
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

    <!-- Connection Form -->
    <div class="card col-span-12">
      <div class="card-heading">Connection Details</div>
      <div class="card-body">
        <form class="conn-form" @submit.prevent="submitForm">

          <!-- Row 1: Host + Port -->
          <div class="form-row">
            <div class="form-group flex-3">
              <label class="form-label" for="input-host">Host</label>
              <input
                id="input-host"
                v-model="host"
                type="text"
                class="form-input"
                placeholder="e.g. my-db.postgres.database.azure.com"
                required
                data-test="host-input"
              />
            </div>
            <div class="form-group flex-1">
              <label class="form-label" for="input-port">Port</label>
              <input
                id="input-port"
                v-model.number="port"
                type="number"
                class="form-input"
                placeholder="5432"
                min="1"
                max="65535"
                required
                data-test="port-input"
              />
            </div>
          </div>

          <!-- Row 2: Database + User -->
          <div class="form-row">
            <div class="form-group flex-1">
              <label class="form-label" for="input-database">Database</label>
              <input
                id="input-database"
                v-model="database"
                type="text"
                class="form-input"
                placeholder="e.g. postgres"
                required
                data-test="database-input"
              />
            </div>
            <div class="form-group flex-1">
              <label class="form-label" for="input-user">User</label>
              <input
                id="input-user"
                v-model="user"
                type="text"
                class="form-input"
                placeholder="e.g. pgadmin"
                required
                autocomplete="username"
                data-test="user-input"
              />
            </div>
          </div>

          <!-- Row 3: Password -->
          <div class="form-row">
            <div class="form-group flex-1">
              <label class="form-label" for="input-password">Password</label>
              <div class="password-wrap">
                <input
                  id="input-password"
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  class="form-input"
                  placeholder="Database password"
                  autocomplete="current-password"
                  data-test="password-input"
                />
                <button
                  type="button"
                  class="toggle-pw"
                  :title="showPassword ? 'Hide password' : 'Show password'"
                  @click="showPassword = !showPassword"
                >
                  {{ showPassword ? '🙈' : '👁️' }}
                </button>
              </div>
            </div>
          </div>

          <!-- Row 4: SSL mode + Timeout -->
          <div class="form-row">
            <div class="form-group flex-1">
              <label class="form-label" for="input-ssl">SSL Mode</label>
              <select id="input-ssl" v-model="sslmode" class="form-input" data-test="ssl-input">
                <option value="disable">disable</option>
                <option value="require">require</option>
                <option value="verify-ca">verify-ca</option>
                <option value="verify-full">verify-full</option>
              </select>
            </div>
            <div class="form-group flex-1">
              <label class="form-label" for="input-timeout">Timeout (ms)</label>
              <input
                id="input-timeout"
                v-model.number="connectTimeoutMs"
                type="number"
                class="form-input"
                placeholder="7000"
                min="1000"
                max="30000"
                step="500"
                data-test="timeout-input"
              />
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="button-row">
            <button
              type="submit"
              class="btn btn-primary"
              :disabled="loading"
              data-test="submit-button"
            >
              <span v-if="loading">⏳ Testing...</span>
              <span v-else>▶ Test Connection</span>
            </button>
            <button
              type="button"
              class="btn"
              :disabled="metricsLoading"
              data-test="metrics-button"
              @click="fetchMetrics"
            >
              <span v-if="metricsLoading">⏳ Loading...</span>
              <span v-else>📊 Fetch Metrics</span>
            </button>
            <button
              type="button"
              class="btn"
              :disabled="schemasLoading || schemaMetricsLoading"
              data-test="schemas-button"
              @click="fetchSchemasAndMetrics"
            >
              <span v-if="schemasLoading || schemaMetricsLoading">⏳ Loading...</span>
              <span v-else>📋 Fetch Schema Metrics</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Loading / Result banners -->
    <div v-if="loading" class="col-span-12">
      <div class="loading"><div class="spinner"></div><span>Testing connectivity...</span></div>
    </div>

    <div v-if="lastResult?.ok" class="col-span-12 notification notification-success" data-test="success-notification">
      <strong>✅ Connection successful!</strong> Latency: {{ lastResult.latencyMs }}ms
    </div>

    <div v-if="error" class="col-span-12 notification notification-error" data-test="error-notification">
      <strong>❌ Connection failed:</strong> {{ error }}
    </div>

    <!-- Connection Details -->
    <div v-if="lastResult?.ok && lastResult.details" class="card col-span-12" data-test="details-card">
      <div class="card-heading">Connection Details</div>
      <div class="card-body">
        <div class="metrics-kv">
          <span class="kv-label">Database</span><span class="kv-value">{{ lastResult.details.database }}</span>
          <span class="kv-label">User</span><span class="kv-value">{{ lastResult.details.user }}</span>
          <span class="kv-label">Server</span><span class="kv-value">{{ lastResult.details.serverAddress }}:{{ lastResult.details.serverPort }}</span>
          <span class="kv-label">Latency</span><span class="kv-value">{{ lastResult.latencyMs }}ms</span>
          <span class="kv-label">Version</span><span class="kv-value">{{ lastResult.details.version }}</span>
        </div>
        <div v-if="lastResult.details.databases?.length" style="margin-top:12px;">
          <strong style="font-size:12px;color:var(--clr-text-muted)">DATABASES</strong>
          <table class="metrics-table" style="margin-top:6px;">
            <thead><tr><th>Name</th><th>Size (MB)</th></tr></thead>
            <tbody>
              <tr v-for="db in lastResult.details.databases" :key="db.name">
                <td>{{ db.name }}</td><td>{{ db.sizeMb.toFixed(2) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Schema Selector -->
    <div v-if="schemasLoading" class="col-span-12">
      <div class="loading"><div class="spinner"></div><span>Fetching schemas...</span></div>
    </div>
    <div v-if="schemasError" class="col-span-12 notification notification-error">
      <strong>Schemas fetch failed:</strong> {{ schemasError }}
    </div>

    <div v-if="postgresSchemas?.ok && availableSchemas.length" class="card col-span-12" data-test="schema-selector-card">
      <div class="card-heading">Select Schema</div>
      <div class="card-body">
        <div class="form-row">
          <div class="form-group flex-2">
            <label class="form-label">Schema</label>
            <select v-model="selectedSchema" class="form-input">
              <option v-for="schema in availableSchemas" :key="schema.schema_name" :value="schema.schema_name">
                {{ schema.schema_name }} ({{ schema.table_count }} tables, {{ schema.index_count }} indexes)
              </option>
            </select>
          </div>
          <div class="form-group flex-1" style="justify-content:flex-end;display:flex;align-items:flex-end;">
            <button type="button" class="btn" :disabled="schemaMetricsLoading" @click="refreshSchemaMetrics">
              📊 Refresh Schema Metrics
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Schema Metrics loading/error -->
    <div v-if="schemaMetricsLoading" class="col-span-12">
      <div class="loading"><div class="spinner"></div><span>Fetching schema metrics...</span></div>
    </div>
    <div v-if="schemaMetricsError" class="col-span-12 notification notification-error">
      <strong>Schema metrics failed:</strong> {{ schemaMetricsError }}
    </div>

    <!-- Schema Query Status -->
    <div v-if="postgresSchemaMetrics?.ok && schemaMetricBlocks.length" class="card col-span-12" data-test="schema-query-status-card">
      <div class="card-heading">Schema Metrics Query Status — {{ postgresSchemaMetrics.schema || 'unknown' }}</div>
      <div class="card-body">
        <table class="metrics-table">
          <thead><tr><th>Metric</th><th>Description</th><th>Result</th><th>Error</th></tr></thead>
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

    <!-- Schema Detail Tables -->
    <template v-if="postgresSchemaMetrics?.ok && schemaInfo">
      <h2 class="col-span-12" style="margin-top:24px;">Schema Metrics: {{ postgresSchemaMetrics.schema }}</h2>

      <div class="card col-span-6" data-test="schema-info-card">
        <div class="card-heading">Schema Info</div>
        <div class="card-body">
          <div class="metrics-kv">
            <span class="kv-label">Schema</span><span class="kv-value">{{ schemaInfo.schema_name }}</span>
            <span class="kv-label">Owner</span><span class="kv-value">{{ schemaInfo.owner }}</span>
            <span class="kv-label">Tables</span><span class="kv-value">{{ schemaInfo.table_count }}</span>
            <span class="kv-label">Indexes</span><span class="kv-value">{{ schemaInfo.index_count }}</span>
          </div>
        </div>
      </div>

      <div class="card col-span-12" data-test="schema-tables-card">
        <div class="card-heading">Tables in Schema</div>
        <div class="card-body">
          <table class="metrics-table" v-if="tables.length">
            <thead><tr><th>Table</th><th>Live Tuples</th><th>Dead Tuples</th><th>Dead %</th><th>Seq Scans</th><th>Idx Scans</th><th>Size (MB)</th><th>Autovac</th></tr></thead>
            <tbody>
              <tr v-for="row in tables" :key="String(row.relname)">
                <td>{{ row.relname }}</td>
                <td>{{ Number(row.n_live_tup).toLocaleString() }}</td>
                <td>{{ Number(row.n_dead_tup).toLocaleString() }}</td>
                <td :style="{ color: Number(row.dead_tuple_pct) > 20 ? 'red' : 'inherit' }">{{ Number(row.dead_tuple_pct || 0).toFixed(2) }}%</td>
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
            <thead><tr><th>Index</th><th>Table</th><th>Scans</th><th>Tuples Read</th><th>Tuples Fetched</th><th>Size</th></tr></thead>
            <tbody>
              <tr v-for="row in indexes" :key="String(row.indexname)">
                <td>{{ row.indexname }}</td><td>{{ row.tablename }}</td>
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

    <div v-if="postgresSchemaMetrics && !postgresSchemaMetrics.ok" class="col-span-12 notification notification-error">
      <strong>Schema metrics error:</strong> {{ postgresSchemaMetrics.error }}
    </div>

    <!-- Postgres Metrics Dashboard -->
    <div v-if="metricsLoading" class="col-span-12">
      <div class="loading"><div class="spinner"></div><span>Fetching PostgreSQL metrics...</span></div>
    </div>
    <div v-if="metricsError" class="col-span-12 notification notification-error" data-test="metrics-error-notification">
      <strong>Metrics fetch failed:</strong> {{ metricsError }}
    </div>

    <template v-if="postgresMetrics?.ok && postgresMetrics.metrics">
      <!-- Server Info + Extensions -->
      <div class="card col-span-6" data-test="server-info-card">
        <div class="card-heading">Server Info</div>
        <div class="card-body">
          <div class="metrics-kv" v-if="serverInfo">
            <span class="kv-label">Version</span><span class="kv-value">{{ String(serverInfo.version ?? '').split(' on ')[0] }}</span>
            <span class="kv-label">Server</span><span class="kv-value">{{ serverInfo.server_addr }}:{{ serverInfo.server_port }}</span>
            <span class="kv-label">User</span><span class="kv-value">{{ serverInfo.user_name }}</span>
            <span class="kv-label">Server Time</span><span class="kv-value">{{ new Date(String(serverInfo.server_time)).toLocaleString() }}</span>
            <span class="kv-label">Latency</span><span class="kv-value">{{ postgresMetrics.latencyMs }}ms</span>
          </div>
        </div>
      </div>

      <div class="card col-span-6" data-test="extensions-card">
        <div class="card-heading">Extensions</div>
        <div class="card-body">
          <div class="ext-list" v-if="extensions.length">
            <span v-for="ext in extensions" :key="String(ext.extname)" class="ext-chip">
              {{ ext.extname }}&nbsp;<em>v{{ ext.extversion }}</em>
            </span>
          </div>
          <span v-else class="empty-msg">No extensions found</span>
        </div>
      </div>

      <!-- Connections + Locks -->
      <div class="card col-span-6" data-test="connections-card">
        <div class="card-heading">Connections</div>
        <div class="card-body">
          <div class="stat-trio">
            <div class="stat-block"><span class="stat-num stat-active">{{ connActive }}</span><span class="stat-lbl">Active</span></div>
            <div class="stat-block"><span class="stat-num">{{ connIdle }}</span><span class="stat-lbl">Idle</span></div>
            <div class="stat-block"><span class="stat-num">{{ connTotal }}</span><span class="stat-lbl">Total</span></div>
          </div>
          <table class="metrics-table" v-if="connectionStats.length">
            <thead><tr><th>State</th><th>Count</th></tr></thead>
            <tbody>
              <tr v-for="row in connectionStats" :key="String(row.state)">
                <td>{{ row.state || 'unknown' }}</td><td>{{ row.count }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card col-span-6" data-test="lock-stats-card">
        <div class="card-heading">Lock Stats</div>
        <div class="card-body">
          <table class="metrics-table" v-if="lockStats.length">
            <thead><tr><th>Mode</th><th>Granted</th><th>Count</th></tr></thead>
            <tbody>
              <tr v-for="row in lockStats" :key="String(row.mode) + String(row.granted)">
                <td>{{ row.mode }}</td><td>{{ row.granted }}</td><td>{{ row.count }}</td>
              </tr>
            </tbody>
          </table>
          <span v-else class="empty-msg">No lock activity</span>
        </div>
      </div>

      <div class="card col-span-6" data-test="wait-events-card">
        <div class="card-heading">Wait Events</div>
        <div class="card-body">
          <table class="metrics-table" v-if="waitEventStats.length">
            <thead><tr><th>Type</th><th>Event</th><th>Sessions</th></tr></thead>
            <tbody>
              <tr v-for="row in waitEventStats" :key="String(row.wait_event_type) + String(row.wait_event)">
                <td>{{ row.wait_event_type }}</td><td>{{ row.wait_event }}</td><td>{{ row.sessions }}</td>
              </tr>
            </tbody>
          </table>
          <span v-else class="empty-msg">No active waits captured</span>
        </div>
      </div>

      <div class="card col-span-6" data-test="blocked-sessions-card">
        <div class="card-heading">Blocked Sessions</div>
        <div class="card-body">
          <table class="metrics-table" v-if="blockingStats.length">
            <thead><tr><th>PID</th><th>Duration</th><th>Blockers</th><th>Query</th></tr></thead>
            <tbody>
              <tr v-for="row in blockingStats" :key="String(row.blocked_pid)">
                <td>{{ row.blocked_pid }}</td><td>{{ row.blocked_duration }}</td>
                <td>{{ row.blocker_count }}</td><td class="query-cell">{{ truncateQuery(row.blocked_query) }}</td>
              </tr>
            </tbody>
          </table>
          <span v-else class="empty-msg">No blocked sessions detected</span>
        </div>
      </div>

      <!-- Database Sizes + WAL/Checkpointer -->
      <div class="card col-span-6" data-test="db-sizes-card">
        <div class="card-heading">Database Sizes</div>
        <div class="card-body">
          <table class="metrics-table" v-if="sizeStats.length">
            <thead><tr><th>Database</th><th>Size (MB)</th></tr></thead>
            <tbody>
              <tr v-for="row in sizeStats" :key="String(row.datname)">
                <td>{{ row.datname }}</td><td>{{ Number(row.size_mb).toFixed(2) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card col-span-6" data-test="wal-card">
        <div class="card-heading">Checkpointer / WAL</div>
        <div class="card-body">
          <div class="metrics-kv">
            <template v-if="bgwriter">
              <span class="kv-label">Checkpoints (timed)</span><span class="kv-value">{{ bgwriter.checkpoints_timed }}</span>
              <span class="kv-label">Checkpoints (req)</span><span class="kv-value">{{ bgwriter.checkpoints_req }}</span>
              <span class="kv-label">Write Time</span><span class="kv-value">{{ (Number(bgwriter.checkpoint_write_time) / 1000).toFixed(1) }}s</span>
              <span class="kv-label">Sync Time</span><span class="kv-value">{{ (Number(bgwriter.checkpoint_sync_time) / 1000).toFixed(1) }}s</span>
            </template>
            <template v-if="walStat">
              <span class="kv-label">WAL Records</span><span class="kv-value">{{ Number(walStat.wal_records).toLocaleString() }}</span>
              <span class="kv-label">WAL Size</span><span class="kv-value">{{ fmtBytes(Number(walStat.wal_bytes)) }}</span>
            </template>
          </div>
        </div>
      </div>

      <!-- Long-Running Queries -->
      <div class="card col-span-12" data-test="long-running-card">
        <div class="card-heading">Long-Running Queries</div>
        <div class="card-body">
          <div v-if="!longRunning.length" class="empty-msg" style="color:green">No long-running queries detected.</div>
          <table class="metrics-table" v-else>
            <thead><tr><th>PID</th><th>Duration</th><th>State</th><th>Query</th></tr></thead>
            <tbody>
              <tr v-for="row in longRunning" :key="String(row.pid)">
                <td>{{ row.pid }}</td><td>{{ row.duration }}</td><td>{{ row.state }}</td>
                <td class="query-cell">{{ truncateQuery(row.query) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card col-span-12" data-test="table-churn-card">
        <div class="card-heading">Table Churn Stats</div>
        <div class="card-body">
          <table class="metrics-table" v-if="tableChurnStats.length">
            <thead><tr><th>Table</th><th>Dead Tuples</th><th>Dead %</th><th>Live Tuples</th><th>Seq Scans</th><th>Idx Scans</th><th>Autovacuum</th></tr></thead>
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
        <div class="card-heading">Temp File Usage</div>
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
      <div v-if="topQueries && topQueries.length" class="card col-span-12" data-test="top-queries-card">
        <div class="card-heading">Top Slow Queries (pg_stat_statements)</div>
        <div class="card-body">
          <table class="metrics-table">
            <thead><tr><th>#</th><th>Calls</th><th>Total (ms)</th><th>Avg (ms)</th><th>Rows</th><th>Cache Hit</th><th>Query</th></tr></thead>
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

      <div v-if="topQueries === null" class="col-span-12 notification notification-info">
        pg_stat_statements extension not available or not enabled.
      </div>

    </template>

    <div v-if="postgresMetrics && !postgresMetrics.ok" class="col-span-12 notification notification-error" data-test="metrics-failed-notification">
      <strong>Metrics error:</strong> {{ postgresMetrics.error }}
    </div>

  </article>
</template>

<style scoped>
.conn-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.form-row {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 140px;
}
.flex-1 { flex: 1; }
.flex-2 { flex: 2; }
.flex-3 { flex: 3; }
.form-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--clr-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.form-input {
  padding: 9px 12px;
  border-radius: 6px;
  border: 1px solid var(--clr-border);
  background: var(--clr-surface);
  color: var(--clr-text);
  font-size: 14px;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.form-input:focus {
  outline: none;
  border-color: var(--clr-primary);
  box-shadow: 0 0 0 3px rgba(37,99,235,0.15);
}
.password-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.password-wrap .form-input {
  padding-right: 42px;
}
.toggle-pw {
  position: absolute;
  right: 8px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  padding: 2px;
  line-height: 1;
  color: var(--clr-text-muted);
}
.toggle-pw:hover { opacity: 0.8; }
.button-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  padding-top: 4px;
}
.btn-primary {
  background: var(--clr-primary);
  color: #fff;
  border: none;
}
.btn-primary:hover:not(:disabled) { background: #1d4ed8; }
.metrics-kv {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 6px 16px;
  align-items: baseline;
}
.kv-label { font-size: 12px; font-weight: 600; color: var(--clr-text-muted); white-space: nowrap; }
.kv-value { font-size: 13px; }
.metrics-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.metrics-table th { text-align: left; padding: 6px 8px; border-bottom: 2px solid var(--clr-border); font-weight: 600; white-space: nowrap; }
.metrics-table td { padding: 5px 8px; border-bottom: 1px solid var(--clr-border-light); vertical-align: top; }
.query-cell { font-family: monospace; font-size: 11px; max-width: 420px; word-break: break-all; }
.stat-trio { display: flex; gap: 24px; margin-bottom: 14px; }
.stat-block { display: flex; flex-direction: column; align-items: center; }
.stat-num { font-size: 30px; font-weight: 700; line-height: 1; }
.stat-num.stat-active { color: var(--clr-primary); }
.stat-lbl { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; color: var(--clr-text-muted); }
.ext-list { display: flex; flex-wrap: wrap; gap: 8px; }
.ext-chip { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 12px; background: var(--clr-border-light); border: 1px solid var(--clr-border); font-size: 12px; }
.ext-chip em { font-style: normal; color: var(--clr-text-muted); }
.empty-msg { font-size: 13px; color: var(--clr-text-muted); }
.metric-desc { font-size: 11px; color: var(--clr-text-muted); }
</style>
