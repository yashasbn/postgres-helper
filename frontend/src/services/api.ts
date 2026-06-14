import type {
  ConnectivityPayload,
  ConnectivityResult,
  PostgresMetricsResult,
  PostgresSchemasPayload,
  PostgresSchemasResult,
  PostgresSchemaMetricsPayload,
  PostgresSchemaMetricsResult,
} from "@/types/connectivity";

const API_BASE = import.meta.env.VITE_API_URL || "";

const genericConnectionFailure = "Error connecting";

const parseJsonOrConnectionError = <T>(text: string): T => {
  if (!text) {
    throw new Error(genericConnectionFailure);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(genericConnectionFailure);
  }
};

export const testConnectivity = async (payload: ConnectivityPayload): Promise<ConnectivityResult> => {
  const response = await fetch(`${API_BASE}/api/connectivity-test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  try {
    return parseJsonOrConnectionError<ConnectivityResult>(text);
  } catch {
    return { ok: false, error: genericConnectionFailure };
  }
};

export const fetchPostgresMetrics = async (payload: ConnectivityPayload): Promise<PostgresMetricsResult> => {
  const response = await fetch(`${API_BASE}/api/postgres-metrics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  if (!text) {
    return { ok: false, error: `Server returned empty response (HTTP ${response.status})` };
  }

  try {
    return JSON.parse(text) as PostgresMetricsResult;
  } catch {
    return { ok: false, error: `Server returned non-JSON response (HTTP ${response.status}): ${text.slice(0, 200)}` };
  }
};

export const fetchPostgresSchemas = async (payload: PostgresSchemasPayload): Promise<PostgresSchemasResult> => {
  const response = await fetch(`${API_BASE}/api/postgres-schemas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  if (!text) {
    return { ok: false, error: `Server returned empty response (HTTP ${response.status})` };
  }

  try {
    return JSON.parse(text) as PostgresSchemasResult;
  } catch {
    return { ok: false, error: `Server returned non-JSON response (HTTP ${response.status}): ${text.slice(0, 200)}` };
  }
};

export const fetchPostgresSchemaMetrics = async (payload: PostgresSchemaMetricsPayload): Promise<PostgresSchemaMetricsResult> => {
  const response = await fetch(`${API_BASE}/api/postgres-schema-metrics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  if (!text) {
    return { ok: false, error: `Server returned empty response (HTTP ${response.status})` };
  }

  try {
    return JSON.parse(text) as PostgresSchemaMetricsResult;
  } catch {
    return { ok: false, error: `Server returned non-JSON response (HTTP ${response.status}): ${text.slice(0, 200)}` };
  }
};
