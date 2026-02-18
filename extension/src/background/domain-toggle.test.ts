import { describe, expect, it } from "vitest";

import {
  getDomainFromUrl,
  getDomainStorageKey,
  isSameDomainUrl,
} from "./domain-toggle";

describe("domain-toggle", () => {
  it("extracts hostname from supported urls", () => {
    expect(getDomainFromUrl("https://example.com/path")).toBe("example.com");
    expect(getDomainFromUrl("http://sub.example.com/a")).toBe("sub.example.com");
  });

  it("returns null for unsupported or invalid urls", () => {
    expect(getDomainFromUrl("chrome://extensions")).toBeNull();
    expect(getDomainFromUrl("not-a-url")).toBeNull();
    expect(getDomainFromUrl(undefined)).toBeNull();
  });

  it("builds deterministic storage key", () => {
    expect(getDomainStorageKey("example.com")).toBe(
      "agentation.domain.toggle.example.com",
    );
  });

  it("matches urls by exact hostname", () => {
    expect(isSameDomainUrl("https://example.com/a", "example.com")).toBe(true);
    expect(isSameDomainUrl("https://a.example.com", "example.com")).toBe(false);
  });
});
