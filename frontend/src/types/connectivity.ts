export type ConnectivityPayload = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  sslmode: "disable" | "require";
  connectTimeoutMs: number;
};

export type ConnectivityResult = {
  ok: boolean;
  latencyMs?: number;
  details?: {
    database: string;
    user: string;
    serverAddress: string;
    serverPort: number;
    version: string;
    databases?: Array<{
      name: string;
      sizeMb: number;
    }>;
  };
  error?: string;
  code?: string;
};

export type PostgresQueryBlock = {
  ok: boolean;
  rows?: Array<Record<string, unknown>>;
  error?: string;
};

export type PostgresMetricsResult = {
  ok: boolean;
  latencyMs?: number;
  target?: {
    host: string;
    port: number;
    database: string;
    user: string;
    sslmode: string;
  };
  metrics?: {
    serverInfo: PostgresQueryBlock;
    extensions: PostgresQueryBlock;
    connectionStats: PostgresQueryBlock;
    dbStats: PostgresQueryBlock;
    bgwriterStats: PostgresQueryBlock;
    walStats: PostgresQueryBlock;
    lockStats: PostgresQueryBlock;
    longRunning: PostgresQueryBlock;
    sizeStats: PostgresQueryBlock;
    waitEventStats: PostgresQueryBlock;
    blockingStats: PostgresQueryBlock;
    tableChurnStats: PostgresQueryBlock;
    tempUsageStats: PostgresQueryBlock;
    pgStatStatements: PostgresQueryBlock;
  };
  error?: string;
  code?: string;
};

export type PostgresSchemasPayload = {
  host: string;
  port: number;
  database: string;
  user: string;
  sslmode: "disable" | "require";
  connectTimeoutMs: number;
};

export type PostgresSchemasResult = {
  ok: boolean;
  latencyMs?: number;
  database?: string;
  schemas?: Array<{
    schema_name: string;
    owner: string;
    table_count: number;
    index_count: number;
    description?: string;
  }>;
  error?: string;
};

export type PostgresSchemaMetricsPayload = {
  host: string;
  port: number;
  database: string;
  schema: string;
  user: string;
  sslmode: "disable" | "require";
  connectTimeoutMs: number;
};

export type PostgresSchemaMetricsResult = {
  ok: boolean;
  latencyMs?: number;
  database?: string;
  schema?: string;
  metrics?: {
    schemaInfo: PostgresQueryBlock;
    tableStats: PostgresQueryBlock;
    indexStats: PostgresQueryBlock;
    waitEventStats: PostgresQueryBlock;
    blockingStats: PostgresQueryBlock;
    tempUsageStats: PostgresQueryBlock;
  };
  error?: string;
  code?: string;
};
