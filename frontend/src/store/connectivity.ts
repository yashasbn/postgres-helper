import { defineStore } from "pinia";
import { ref, type Ref } from "vue";
import type {
  ConnectivityPayload,
  ConnectivityResult,
  HealthStatus,
  PingPayload,
  PingResult,
  PostgresMetricsResult,
  PostgresSchemasPayload,
  PostgresSchemasResult,
  PostgresSchemaMetricsPayload,
  PostgresSchemaMetricsResult,
  HostReachabilityPayload,
  HostReachabilityResult,
} from "@/types/connectivity";
import { checkHealth, fetchPrometheus, testConnectivity, pingHost, fetchPostgresMetrics, fetchPostgresSchemas, fetchPostgresSchemaMetrics, checkHostReachability } from "@/services/api";

export const useConnectivityStore = defineStore("connectivity", () => {
  const healthStatus: Ref<HealthStatus> = ref("CHECKING");
  const metrics: Ref<string> = ref("");
  const loading: Ref<boolean> = ref(false);
  const lastResult: Ref<ConnectivityResult | null> = ref(null);
  const error: Ref<string | null> = ref(null);
  const metricsLoading: Ref<boolean> = ref(false);
  const postgresMetrics: Ref<PostgresMetricsResult | null> = ref(null);
  const metricsError: Ref<string | null> = ref(null);
  const schemasLoading: Ref<boolean> = ref(false);
  const postgresSchemas: Ref<PostgresSchemasResult | null> = ref(null);
  const schemasError: Ref<string | null> = ref(null);
  const schemaMetricsLoading: Ref<boolean> = ref(false);
  const postgresSchemaMetrics: Ref<PostgresSchemaMetricsResult | null> = ref(null);
  const schemaMetricsError: Ref<string | null> = ref(null);
  const pinging: Ref<boolean> = ref(false);
  const pingResults: Ref<PingResult[]> = ref([]);
  const hostReachableLoading: Ref<boolean> = ref(false);
  const hostReachableResult: Ref<HostReachabilityResult | null> = ref(null);

  const refreshHealth = async (): Promise<void> => {
    healthStatus.value = "CHECKING";
    try {
      await checkHealth();
      healthStatus.value = "OK";
    } catch {
      healthStatus.value = "ERROR";
    }
  };

  const refreshMetrics = async (): Promise<void> => {
    try {
      const raw = await fetchPrometheus();
      metrics.value = raw
        .split("\n")
        .map((line) => line.trimEnd())
        .filter((line) => line.length > 0)
        .slice(0, 40)
        .join("\n");
    } catch (e) {
      metrics.value = e instanceof Error ? e.message : "Metrics fetch failed";
    }
  };

  const runConnectivityTest = async (payload: ConnectivityPayload): Promise<void> => {
    loading.value = true;
    error.value = null;
    lastResult.value = null;
    try {
      lastResult.value = await testConnectivity(payload);
      if (!lastResult.value.ok) {
        error.value = lastResult.value.error || "Connectivity test failed";
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Request failed";
    } finally {
      loading.value = false;
    }
  };

  const runPing = async (payloads: PingPayload[]): Promise<void> => {
    pinging.value = true;
    pingResults.value = [];
    try {
      const results = await Promise.all(payloads.map((p) => pingHost(p)));
      pingResults.value = results;
    } catch (e) {
      pingResults.value = payloads.map((p) => ({
        ok: false,
        host: p.host,
        port: p.port,
        latencyMs: 0,
        dnsOk: false,
        tcpOk: false,
        error: e instanceof Error ? e.message : "Ping failed"
      }));
    } finally {
      pinging.value = false;
    }
  };

  const runPostgresMetrics = async (payload: ConnectivityPayload): Promise<void> => {
    metricsLoading.value = true;
    postgresMetrics.value = null;
    metricsError.value = null;
    try {
      const result = await fetchPostgresMetrics(payload);
      postgresMetrics.value = result;
      if (!result.ok) {
        metricsError.value = result.error || "Metrics fetch failed";
      }
    } catch (e) {
      metricsError.value = e instanceof Error ? e.message : "Metrics fetch failed";
    } finally {
      metricsLoading.value = false;
    }
  };

  const runFetchSchemas = async (payload: PostgresSchemasPayload): Promise<void> => {
    schemasLoading.value = true;
    postgresSchemas.value = null;
    schemasError.value = null;
    try {
      const result = await fetchPostgresSchemas(payload);
      postgresSchemas.value = result;
      if (!result.ok) {
        schemasError.value = result.error || "Schemas fetch failed";
      }
    } catch (e) {
      schemasError.value = e instanceof Error ? e.message : "Schemas fetch failed";
    } finally {
      schemasLoading.value = false;
    }
  };

  const runFetchSchemaMetrics = async (payload: PostgresSchemaMetricsPayload): Promise<void> => {
    schemaMetricsLoading.value = true;
    postgresSchemaMetrics.value = null;
    schemaMetricsError.value = null;
    try {
      const result = await fetchPostgresSchemaMetrics(payload);
      postgresSchemaMetrics.value = result;
      if (!result.ok) {
        schemaMetricsError.value = result.error || "Schema metrics fetch failed";
      }
    } catch (e) {
      schemaMetricsError.value = e instanceof Error ? e.message : "Schema metrics fetch failed";
    } finally {
      schemaMetricsLoading.value = false;
    }
  };

  const runHostReachability = async (payload: HostReachabilityPayload): Promise<void> => {
    hostReachableLoading.value = true;
    hostReachableResult.value = null;
    try {
      hostReachableResult.value = await checkHostReachability(payload);
    } catch (e) {
      hostReachableResult.value = {
        ok: false,
        host: payload.host,
        error: e instanceof Error ? e.message : "Request failed"
      };
    } finally {
      hostReachableLoading.value = false;
    }
  };

  return {
    healthStatus,
    metrics,
    loading,
    lastResult,
    error,
    metricsLoading,
    postgresMetrics,
    metricsError,
    schemasLoading,
    postgresSchemas,
    schemasError,
    schemaMetricsLoading,
    postgresSchemaMetrics,
    schemaMetricsError,
    pinging,
    pingResults,
    hostReachableLoading,
    hostReachableResult,
    refreshHealth,
    refreshMetrics,
    runConnectivityTest,
    runPostgresMetrics,
    runFetchSchemas,
    runFetchSchemaMetrics,
    runPing,
    runHostReachability
  };
});
