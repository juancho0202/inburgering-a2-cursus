export interface CompleteArgs {
  system: string;
  user: string;
  schema: Record<string, unknown>;
  maxTokens: number;
}

export interface CompleteResult {
  text: string;
  usage: { inputTokens: number; outputTokens: number };
}

/** The only thing the rest of the app knows about Claude. Tests use a fake. */
export interface ClaudeGateway {
  complete(args: CompleteArgs): Promise<CompleteResult>;
}

export class NoApiKeyError extends Error {
  constructor() {
    super("no_api_key");
  }
}
