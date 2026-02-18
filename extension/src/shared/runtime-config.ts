export type RuntimeConfig = {
  backendUrl: string;
  model: string;
  temperature: number;
  mcpEndpoint: string;
};

type RuntimeConfigSource = {
  backendUrl?: string;
  model?: string;
  temperature?: string | number;
  mcpEndpoint?: string;
};

const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  backendUrl: "http://localhost:8000",
  model: "qwen3.5-plus",
  temperature: 0.2,
  mcpEndpoint: "http://localhost:4747",
};

function normalizeString(value: string | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeTemperature(value: string | number | undefined): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function resolveRuntimeConfig(source: RuntimeConfigSource): RuntimeConfig {
  return {
    backendUrl:
      normalizeString(source.backendUrl) ?? DEFAULT_RUNTIME_CONFIG.backendUrl,
    model: normalizeString(source.model) ?? DEFAULT_RUNTIME_CONFIG.model,
    temperature:
      normalizeTemperature(source.temperature) ??
      DEFAULT_RUNTIME_CONFIG.temperature,
    mcpEndpoint:
      normalizeString(source.mcpEndpoint) ?? DEFAULT_RUNTIME_CONFIG.mcpEndpoint,
  };
}

const INJECTED_SOURCE: RuntimeConfigSource = {
  backendUrl:
    typeof __EXTENSION_BACKEND_URL__ !== "undefined"
      ? __EXTENSION_BACKEND_URL__
      : undefined,
  model:
    typeof __EXTENSION_MODEL__ !== "undefined" ? __EXTENSION_MODEL__ : undefined,
  temperature:
    typeof __EXTENSION_TEMPERATURE__ !== "undefined"
      ? __EXTENSION_TEMPERATURE__
      : undefined,
  mcpEndpoint:
    typeof __EXTENSION_MCP_ENDPOINT__ !== "undefined"
      ? __EXTENSION_MCP_ENDPOINT__
      : undefined,
};

export const RUNTIME_CONFIG = resolveRuntimeConfig(INJECTED_SOURCE);
