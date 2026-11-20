/** Models offered in Settings. The first is the default (good balance of quality and cost). */
export const MODELS = [
  { id: "claude-sonnet-5-5", label: "Sonnet 5.5 (aanbevolen)" },
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5 (goedkoop en snel)" },
  { id: "claude-opus-5-5", label: "Opus 5.5 (beste kwaliteit, duurder)" },
] as const;

/** output_config.effort: the current models take it; Haiku 4.5 and older answer it with an error. */
export const supportsEffort = (model: string) => !/(haiku|sonnet|opus)-4-5|-3-/.test(model);
