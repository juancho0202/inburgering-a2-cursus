import { mapClaudeError } from "./errors.js";
import { NoApiKeyError, type ClaudeGateway } from "./gateway.js";

export interface BrowserGatewayOptions {
  /** Gives the plain key just in time (decrypted from the vault), or null when there is none. */
  getKey: () => Promise<string | null>;
  getModel: () => Promise<string>;
  /** For tests. */
  fetch?: typeof fetch;
  maxRetries?: number;
}

/** The SDK is loaded on first use, so it is not part of the first page load. */
async function makeClient(apiKey: string, o: Pick<BrowserGatewayOptions, "fetch" | "maxRetries">) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  // "dangerouslyAllowBrowser" is the SDK's reminder that a key in a page can be read by code on that page.
  // Here it is the learner's own key on the learner's own device (see docs/production-readiness.md §5).
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: o.maxRetries ?? 2, timeout: 60_000, fetch: o.fetch });
}

/** Claude calls made straight from the browser with the learner's own key, using structured outputs. */
export function createBrowserGateway(options: BrowserGatewayOptions): ClaudeGateway {
  return {
    async complete({ system, user, schema, maxTokens }) {
      const apiKey = await options.getKey();
      if (!apiKey) throw new NoApiKeyError();
      const client = await makeClient(apiKey, options);
      const res = await client.messages.create({
        model: await options.getModel(),
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: user }],
        output_config: { format: { type: "json_schema", schema } },
      });
      const block = res.content.find((b) => b.type === "text");
      return {
        text: block && block.type === "text" ? block.text : "{}",
        usage: { inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens },
      };
    },
  };
}

/** A tiny request (max 20 tokens) to see whether the key works. Answers in Dutch. */
export async function testApiKey(
  apiKey: string,
  model: string,
  o: Pick<BrowserGatewayOptions, "fetch" | "maxRetries"> = {},
): Promise<{ ok: boolean; message: string }> {
  try {
    const client = await makeClient(apiKey, o);
    await client.messages.create({ model, max_tokens: 20, messages: [{ role: "user", content: "Zeg alleen: hallo" }] });
    return { ok: true, message: "Sleutel werkt." };
  } catch (err) {
    return { ok: false, message: mapClaudeError(err) };
  }
}
