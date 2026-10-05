import Anthropic from "@anthropic-ai/sdk";
import type { Settings } from "../../shared/types.js";

export function buildClient(settings: Settings): Anthropic | null {
  const apiKey = settings.apiKey ?? process.env.ANTHROPIC_API_KEY ?? null;
  if (!apiKey) return null;
  return new Anthropic({ apiKey, maxRetries: 2, timeout: 60_000 });
}

export { maskKey, mapClaudeError } from "../../shared/claude/errors.js";
