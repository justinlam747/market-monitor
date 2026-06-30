// Pure safety helpers. No I/O, no LLM — fully unit-testable.
// Used by validate_input and scrape_company_site to enforce the safety rules
// that override run mode (add-on §6).

export interface UrlValidation {
  ok: boolean;
  reason?: string;
  blockedUrl?: boolean;
  normalizedUrl?: string;
}

const MAX_URL_LENGTH = 2048;

// Matches obvious private / internal / link-local hosts (SSRF guard).
function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");

  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "::1" || h === "0.0.0.0") return true;

  // IPv4 dotted-quad checks
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // loopback
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local incl. cloud metadata
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  }

  // IPv6 unique-local / link-local prefixes
  if (h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) return true;

  return false;
}

export function validateUrl(raw: string | undefined | null): UrlValidation {
  if (!raw || typeof raw !== "string") {
    return { ok: false, reason: "No URL provided", blockedUrl: true };
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: "Empty URL", blockedUrl: true };
  }
  if (trimmed.length > MAX_URL_LENGTH) {
    return { ok: false, reason: "URL exceeds maximum length", blockedUrl: true };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, reason: "Malformed URL", blockedUrl: true };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return {
      ok: false,
      reason: `Unsupported protocol: ${url.protocol}`,
      blockedUrl: true,
    };
  }

  if (isPrivateHost(url.hostname)) {
    return {
      ok: false,
      reason: "Private or internal host is not allowed",
      blockedUrl: true,
    };
  }

  return { ok: true, normalizedUrl: url.toString() };
}

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions/i,
  /disregard\s+(?:all\s+)?(?:previous|prior|the)\s+(?:instructions|prompt)/i,
  /you\s+are\s+now\s+/i,
  /system\s+prompt/i,
  /\bact\s+as\s+(?:an?\s+)?(?:dan|jailbreak)/i,
  /reveal\s+your\s+(?:system\s+)?prompt/i,
  /override\s+your\s+(?:instructions|guardrails)/i,
];

// Heuristic prompt-injection detector for scraped page text. Conservative —
// flags only fairly explicit attempts so legitimate copy isn't blocked.
export function detectPromptInjection(text: string | undefined | null): boolean {
  if (!text) return false;
  return INJECTION_PATTERNS.some((re) => re.test(text));
}
