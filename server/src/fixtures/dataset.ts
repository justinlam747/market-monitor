import type { ClaimType, CompetitorProfile } from "@shared/types";

// Deterministic, offline dataset used when AGENT_MODE=fixture (and by tests).
// Evidence strings are guaranteed substrings of the corresponding source text,
// so the (pure) evidence evaluator grounds them.

export interface FixtureSearchResult {
  url: string;
  title: string;
  snippet: string;
}

export interface FixtureClaimTemplate {
  type: ClaimType;
  value: string;
  evidence: string | null; // null => unknown / ungrounded
  confidence: number;
}

export interface FixtureSource {
  url: string;
  title: string;
  snippet: string;
  text: string;
  claims: FixtureClaimTemplate[];
}

export interface FixtureCompetitor {
  name: string;
  sources: FixtureSource[];
}

export interface FixtureCompany {
  url: string;
  businessIdea: string;
  targetCustomer: string;
  competitors: FixtureCompetitor[];
  gapAnalysis: {
    competitorProfiles: CompetitorProfile[];
    sharedPatterns: string[];
    gaps: string[];
    recommendation: string;
  };
}

export const DEFAULT_COMPANY_URL = "https://acme-ai.example.com";

// The company's own landing page text (read by scrape_company_site).
export const COMPANY_PAGE: FixtureSource = {
  url: DEFAULT_COMPANY_URL,
  title: "Acme AI — Marketing Automation for Ecommerce",
  snippet: "AI-powered marketing automation for ecommerce brands.",
  text: "Acme AI is an AI-powered marketing automation platform for ecommerce brands. We help direct-to-consumer ecommerce marketing teams plan, launch, and optimize campaigns across channels from a single workspace.",
  claims: [],
};

export const FIXTURE_COMPANY: FixtureCompany = {
  url: DEFAULT_COMPANY_URL,
  businessIdea:
    "AI-powered marketing automation platform for ecommerce brands",
  targetCustomer: "Direct-to-consumer ecommerce marketing teams",
  competitors: [
    {
      name: "Hypesonic",
      sources: [
        {
          url: "https://hypesonic.example.com/product",
          title: "Hypesonic — AI Marketing Platform",
          snippet: "AI marketing platform for DTC ecommerce brands.",
          text: "Hypesonic is an AI marketing platform built for fast-growing DTC ecommerce brands. The product helps marketing teams automate ad creative generation and campaign optimization. Pricing starts at $99 per month for the Growth plan. Hypesonic recently launched a TikTok ad integration in 2025. Hypesonic is backed by investors including Sequoia Capital, having raised a $20M Series B in 2025.",
          claims: [
            {
              type: "positioning",
              value: "AI marketing platform for DTC ecommerce brands",
              evidence:
                "AI marketing platform built for fast-growing DTC ecommerce brands",
              confidence: 0.9,
            },
            {
              type: "target_customer",
              value: "DTC ecommerce marketing teams",
              evidence:
                "helps marketing teams automate ad creative generation",
              confidence: 0.85,
            },
            {
              type: "feature",
              value: "Ad creative generation and campaign optimization",
              evidence:
                "automate ad creative generation and campaign optimization",
              confidence: 0.88,
            },
            {
              type: "pricing",
              value: "$99/month Growth plan",
              evidence: "Pricing starts at $99 per month for the Growth plan",
              confidence: 0.9,
            },
            {
              type: "recent_signal",
              value: "Launched a TikTok ad integration (2025)",
              evidence: "recently launched a TikTok ad integration in 2025",
              confidence: 0.8,
            },
            {
              type: "funding",
              value: "Backed by Sequoia Capital — $20M Series B (2025)",
              evidence:
                "backed by investors including Sequoia Capital, having raised a $20M Series B in 2025",
              confidence: 0.85,
            },
          ],
        },
      ],
    },
    {
      name: "BrandPilot",
      sources: [
        {
          url: "https://brandpilot.example.com/about",
          title: "BrandPilot — Ecommerce Marketing Analytics",
          snippet: "Analytics dashboard for ecommerce marketers.",
          text: "BrandPilot provides an analytics dashboard for ecommerce marketers. It is designed for online retail marketing teams who want to track campaign performance. Key features include attribution reporting and budget pacing. BrandPilot launched a new AI insights dashboard in 2025 and raised a $12M Series A led by Accel.",
          claims: [
            {
              type: "positioning",
              value: "Analytics dashboard for ecommerce marketers",
              evidence:
                "BrandPilot provides an analytics dashboard for ecommerce marketers",
              confidence: 0.9,
            },
            {
              type: "target_customer",
              value: "Online retail marketing teams",
              evidence: "designed for online retail marketing teams",
              confidence: 0.85,
            },
            {
              type: "feature",
              value: "Attribution reporting and budget pacing",
              evidence:
                "Key features include attribution reporting and budget pacing",
              confidence: 0.87,
            },
            {
              type: "recent_signal",
              value: "Launched a new AI insights dashboard (2025)",
              evidence: "launched a new AI insights dashboard in 2025",
              confidence: 0.82,
            },
            {
              type: "funding",
              value: "$12M Series A led by Accel",
              evidence: "raised a $12M Series A led by Accel",
              confidence: 0.85,
            },
          ],
        },
      ],
    },
  ],
  gapAnalysis: {
    competitorProfiles: [
      {
        name: "Hypesonic",
        summary:
          "Hypesonic is an AI marketing platform for fast-growing DTC ecommerce brands, automating ad creative generation and campaign optimization with a low $99/mo entry point aimed at lean marketing teams.",
        movement:
          "Backed by Sequoia Capital with a $20M Series B (2025) and just shipped a TikTok ad integration — moving aggressively into social commerce and creator-driven acquisition.",
      },
      {
        name: "BrandPilot",
        summary:
          "BrandPilot is an analytics dashboard for online retail marketing teams, centered on attribution reporting and budget pacing to track campaign performance.",
        movement:
          "Raised a $12M Series A led by Accel and launched a new AI insights dashboard in 2025 — shifting from passive reporting toward AI-driven recommendations.",
      },
    ],
    sharedPatterns: [
      "Both competitors target ecommerce marketing teams",
      "Both emphasize campaign performance and automation",
    ],
    gaps: [
      "Neither focuses on early-stage Shopify merchants",
      "Limited guided onboarding for non-technical founders",
    ],
    recommendation:
      "Differentiate by serving early-stage Shopify merchants with guided, done-for-you campaign onboarding that the incumbents leave to self-serve.",
  },
};

// A deliberately sparse source: positioning is stated but the target customer is
// absent, so the extractor must mark target_customer as unknown (test fixture).
export const SPARSE_SOURCE: FixtureSource = {
  url: "https://vaguely.example.com/home",
  title: "Vaguely",
  snippet: "We build software.",
  text: "Vaguely is a modern software platform. We help businesses do more with less.",
  claims: [
    {
      type: "positioning",
      value: "Modern software platform",
      evidence: "Vaguely is a modern software platform",
      confidence: 0.7,
    },
    {
      type: "target_customer",
      value: "unknown",
      evidence: null,
      confidence: 0.2,
    },
    {
      type: "feature",
      value: "unknown",
      evidence: null,
      confidence: 0.2,
    },
  ],
};

export function findFixtureCompetitor(
  name: string
): FixtureCompetitor | undefined {
  const n = name.trim().toLowerCase();
  return FIXTURE_COMPANY.competitors.find(
    (c) => c.name.toLowerCase() === n
  );
}

export function findFixtureSourceByUrl(url: string): FixtureSource | undefined {
  if (COMPANY_PAGE.url === url) return COMPANY_PAGE;
  for (const c of FIXTURE_COMPANY.competitors) {
    const s = c.sources.find((s) => s.url === url);
    if (s) return s;
  }
  if (SPARSE_SOURCE.url === url) return SPARSE_SOURCE;
  return undefined;
}
