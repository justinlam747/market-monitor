import { tavily, type TavilyClient } from "@tavily/core";
import { config } from "../../config.js";

let _client: TavilyClient | null = null;

export function getTavily(): TavilyClient {
  if (!_client) {
    if (!config.tavilyApiKey) {
      throw new Error(
        "TAVILY_API_KEY is not set. Set it in .env or run with AGENT_MODE=fixture."
      );
    }
    _client = tavily({ apiKey: config.tavilyApiKey });
  }
  return _client;
}
