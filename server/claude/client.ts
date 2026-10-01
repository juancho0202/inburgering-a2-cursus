import Anthropic from "@anthropic-ai/sdk";
import type { Settings } from "../../shared/types.js";

export function buildClient(settings: Settings): Anthropic | null {
  const apiKey = settings.apiKey ?? process.env.ANTHROPIC_API_KEY ?? null;
  if (!apiKey) return null;
  return new Anthropic({ apiKey, maxRetries: 2, timeout: 60_000 });
}

export function maskKey(apiKey: string | null): string | null {
  if (!apiKey) return null;
  if (apiKey.length <= 8) return "sk-ant-…";
  return `${apiKey.slice(0, 7)}…${apiKey.slice(-4)}`;
}

export function mapClaudeError(err: unknown): string {
  const anyErr = err as { status?: number; message?: string };
  if (anyErr?.status === 401) return "De API-sleutel klopt niet.";
  if (anyErr?.status === 429) return "Te veel verzoeken. Probeer het over een minuut opnieuw.";
  if (anyErr?.status && anyErr.status >= 500) return "Claude is even niet bereikbaar. Je antwoord is wel opgeslagen.";
  if (anyErr?.message?.toLowerCase().includes("network")) return "Geen internet.";
  return "Er ging iets mis met Claude. Je antwoord is wel opgeslagen.";
}
