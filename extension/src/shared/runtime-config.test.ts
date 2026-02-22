import { describe, expect, it } from "vitest";

import { resolveRuntimeConfig } from "./runtime-config";

describe("resolveRuntimeConfig", () => {
  it("falls back to defaults when values are missing", () => {
    const config = resolveRuntimeConfig({});

    expect(config.backendUrl).toBe("http://localhost:8000");
    expect(config.model).toBe("qwen3.5-plus");
    expect(config.temperature).toBe(0.2);
    expect(config.mcpEndpoint).toBe("http://localhost:4747");
    expect(config.generationTimeoutMs).toBe(300000);
  });

  it("normalizes and parses configured values", () => {
    const config = resolveRuntimeConfig({
      backendUrl: " https://example-backend.test ",
      model: " qwen3.5-plus ",
      temperature: " 0.7 ",
      mcpEndpoint: " http://localhost:4747 ",
      generationTimeoutMs: " 180000 ",
    });

    expect(config.backendUrl).toBe("https://example-backend.test");
    expect(config.model).toBe("qwen3.5-plus");
    expect(config.temperature).toBe(0.7);
    expect(config.mcpEndpoint).toBe("http://localhost:4747");
    expect(config.generationTimeoutMs).toBe(180000);
  });

  it("uses default temperature when value is invalid", () => {
    const config = resolveRuntimeConfig({
      temperature: "not-a-number",
      generationTimeoutMs: "oops",
    });

    expect(config.temperature).toBe(0.2);
    expect(config.generationTimeoutMs).toBe(300000);
  });
});
