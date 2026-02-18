const DOMAIN_TOGGLE_STORAGE_PREFIX = "agentation.domain.toggle.";

export function getDomainFromUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.hostname;
  } catch {
    return null;
  }
}

export function getDomainStorageKey(domain: string): string {
  return `${DOMAIN_TOGGLE_STORAGE_PREFIX}${domain}`;
}

export function isSameDomainUrl(url: string | undefined, domain: string): boolean {
  return getDomainFromUrl(url) === domain;
}
