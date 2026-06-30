import * as cheerio from "cheerio";
import { isFixtureMode } from "../../config.js";
import { LIMITS } from "../limits.js";
import { findFixtureSourceByUrl } from "../../fixtures/dataset.js";
import { getTavily } from "./tavilyClient.js";

export interface ReadResult {
  url: string;
  title?: string;
  text: string;
}

function truncate(text: string): string {
  return text.length > LIMITS.maxSourceChars
    ? text.slice(0, LIMITS.maxSourceChars)
    : text;
}

// Tool 2: Website reader. Fetches and cleans page text.
export async function readPage(url: string): Promise<ReadResult> {
  if (isFixtureMode()) {
    const fx = findFixtureSourceByUrl(url);
    return {
      url,
      title: fx?.title,
      text: truncate(fx?.text ?? ""),
    };
  }

  // Live: prefer Tavily extract (clean text), fall back to fetch + cheerio.
  try {
    const tvly = getTavily();
    const res = await tvly.extract([url]);
    const first = res.results?.[0];
    if (first?.rawContent) {
      return { url, text: truncate(first.rawContent) };
    }
  } catch {
    // fall through to manual fetch
  }

  return fetchAndClean(url);
}

async function fetchAndClean(url: string): Promise<ReadResult> {
  const resp = await fetch(url, {
    headers: { "user-agent": "CompetitorSignalAgent/1.0" },
    redirect: "follow",
  });
  const html = await resp.text();
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, header, footer, nav").remove();
  const title = $("title").first().text().trim() || undefined;
  const text = $("body").text().replace(/\s+/g, " ").trim();
  return { url, title, text: truncate(text) };
}
