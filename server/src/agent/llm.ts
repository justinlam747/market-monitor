import { ChatOpenAI } from "@langchain/openai";
import { config } from "../config.js";

// Factory for the chat model used by identity / discovery / extractor / gap nodes.
// Never constructed in fixture mode (those tools short-circuit to fixtures).
let _model: ChatOpenAI | null = null;

export function getModel(): ChatOpenAI {
  if (!_model) {
    if (!config.openaiApiKey) {
      throw new Error(
        "OPENAI_API_KEY is not set. Set it in .env or run with AGENT_MODE=fixture."
      );
    }
    _model = new ChatOpenAI({
      apiKey: config.openaiApiKey,
      model: config.openaiModel,
      temperature: 0,
    });
  }
  return _model;
}
