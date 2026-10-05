import type { Settings } from "../../shared/types.js";
import { NoApiKeyError, type ClaudeGateway } from "../../shared/claude/gateway.js";
import { buildClient } from "./client.js";

export { NoApiKeyError };
export type { ClaudeGateway };

/** Real gateway: Messages API with structured outputs (JSON schema). */
export function createGateway(settings: Settings): ClaudeGateway {
  const client = buildClient(settings);
  if (!client) throw new NoApiKeyError();
  return {
    async complete({ system, user, schema, maxTokens }) {
      const res = await client.messages.create({
        model: settings.model,
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
