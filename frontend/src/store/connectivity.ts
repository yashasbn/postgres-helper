import { defineStore } from "pinia";
import { ref, type Ref } from "vue";
import type {
  ConnectivityPayload,
  ConnectivityResult,
  PostgresMetricsResult,
  PostgresSchemasPayload,
  PostgresSchemasResult,
  PostgresSchemaMetricsPayload,
  PostgresSchemaMetricsResult,
} from "@/types/connectivity";
import {
  testConnectivity,
  fetchPostgresMetrics,
  fetchPostgresSchemas,
  fetchPostgresSchemaMetrics,
} from "@/services/api";

export const useConnectivityStore = defineStore("connectivity", () => {
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

  return {
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
    runConnectivityTest,
    runPostgresMetrics,
    runFetchSchemas,
    runFetchSchemaMetrics,
  };
});
