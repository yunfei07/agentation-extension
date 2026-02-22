import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const extensionRoot = resolve(scriptDir, "..");
const repoRoot = resolve(extensionRoot, "..");
const backendEnvPath = resolve(repoRoot, "backend", ".env");

function parseDotEnv(content) {
  const parsed = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (!key) continue;

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
}

function loadEnvFile(path) {
  try {
    const content = readFileSync(path, "utf8");
    return parseDotEnv(content);
  } catch (error) {
    console.warn(
      `[extension build] Could not read ${path}. Using default runtime config.`,
      error instanceof Error ? error.message : String(error),
    );
    return {};
  }
}

function pickValue(parsed, key, fallback) {
  const rawValue = parsed[key];
  if (typeof rawValue !== "string") return fallback;
  const trimmed = rawValue.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function resolveRuntimeConfig(parsedEnv) {
  const model = pickValue(
    parsedEnv,
    "EXTENSION_MODEL",
    pickValue(parsedEnv, "LLM_MODEL", "qwen3.5-plus"),
  );
  const temperature = pickValue(
    parsedEnv,
    "EXTENSION_TEMPERATURE",
    pickValue(parsedEnv, "LLM_TEMPERATURE", "0.2"),
  );

  return {
    backendUrl: pickValue(
      parsedEnv,
      "EXTENSION_BACKEND_URL",
      "http://localhost:8000",
    ),
    model,
    temperature,
    mcpEndpoint: pickValue(
      parsedEnv,
      "EXTENSION_MCP_ENDPOINT",
      "http://localhost:4747",
    ),
    generationTimeoutMs: pickValue(
      parsedEnv,
      "EXTENSION_GENERATION_TIMEOUT_MS",
      "300000",
    ),
  };
}

const parsedEnv = loadEnvFile(backendEnvPath);
const runtimeConfig = resolveRuntimeConfig(parsedEnv);

const define = {
  __EXTENSION_BACKEND_URL__: JSON.stringify(runtimeConfig.backendUrl),
  __EXTENSION_MODEL__: JSON.stringify(runtimeConfig.model),
  __EXTENSION_TEMPERATURE__: JSON.stringify(runtimeConfig.temperature),
  __EXTENSION_MCP_ENDPOINT__: JSON.stringify(runtimeConfig.mcpEndpoint),
  __EXTENSION_GENERATION_TIMEOUT_MS__: JSON.stringify(
    runtimeConfig.generationTimeoutMs,
  ),
};

const commonBuildOptions = {
  bundle: true,
  format: "iife",
  target: "es2020",
  define,
  logLevel: "info",
};

await Promise.all([
  build({
    ...commonBuildOptions,
    entryPoints: [resolve(extensionRoot, "src/content/main.tsx")],
    outfile: resolve(extensionRoot, "dist/content.js"),
    jsx: "automatic",
  }),
  build({
    ...commonBuildOptions,
    entryPoints: [resolve(extensionRoot, "src/background/service-worker.ts")],
    outfile: resolve(extensionRoot, "dist/background.js"),
  }),
  build({
    ...commonBuildOptions,
    entryPoints: [resolve(extensionRoot, "src/popup/main.tsx")],
    outfile: resolve(extensionRoot, "dist/popup.js"),
    jsx: "automatic",
  }),
]);

console.info(
  `[extension build] Runtime config loaded from backend/.env: backendUrl=${runtimeConfig.backendUrl}, model=${runtimeConfig.model}, temperature=${runtimeConfig.temperature}, mcpEndpoint=${runtimeConfig.mcpEndpoint}, generationTimeoutMs=${runtimeConfig.generationTimeoutMs}`,
);
