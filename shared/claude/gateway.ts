export interface CompleteArgs {
  system: string;
  user: string;
  schema: Record<string, unknown>;
  /** Thinking counts against this too: give room, only the tokens used are paid for. */
  maxTokens: number;
  /** How hard the model thinks (output_config.effort). Sent only to models that support it. */
  effort?: "low" | "medium" | "high";
}

export interface CompleteResult {
  text: string;
  usage: { inputTokens: number; outputTokens: number };
  /** Why the answer ended: "end_turn", or "max_tokens" (cut off), "refusal" (declined), … */
  stopReason?: string | null;
}

/** The only thing the rest of the app knows about Claude. Tests use a fake. */
export interface ClaudeGateway {
  complete(args: CompleteArgs): Promise<CompleteResult>;
}

/** Claude declined to answer (stop_reason "refusal"); asking again does not help. */
export class ClaudeRefusalError extends Error {
  constructor() {
    super("refusal");
  }
}

export class NoApiKeyError extends Error {
  constructor() {
    super("no_api_key");
  }
}
