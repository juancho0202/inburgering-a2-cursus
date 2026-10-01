import { Router } from "express";
import { z } from "zod";
import { loadSettings, saveSettings } from "../db/progressRepo.js";
import { buildClient, maskKey, mapClaudeError } from "../claude/client.js";

export const settingsRouter = Router();

settingsRouter.get("/settings", async (_req, res) => {
  const settings = await loadSettings();
  res.json({ ...settings, apiKey: maskKey(settings.apiKey) });
});

const UpdateSettingsSchema = z.object({
  apiKey: z.string().nullable().optional(),
  model: z.string().optional(),
  dailyGoalMinutes: z.number().int().optional(),
  newCardsPerDay: z.number().int().optional(),
  speechRate: z.number().optional(),
  spellcheckWriting: z.boolean().optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
});

settingsRouter.put("/settings", async (req, res) => {
  const parsed = UpdateSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "invalid_body", message: "De instellingen zijn niet geldig." } });
    return;
  }
  const current = await loadSettings();
  const next = { ...current, ...parsed.data };
  await saveSettings(next);
  res.json({ ...next, apiKey: maskKey(next.apiKey) });
});

settingsRouter.post("/settings/test-key", async (_req, res) => {
  const settings = await loadSettings();
  const client = buildClient(settings);
  if (!client) {
    res.json({ ok: false, message: "Voeg eerst een API-sleutel toe." });
    return;
  }
  try {
    await client.messages.create({
      model: settings.model,
      max_tokens: 20,
      messages: [{ role: "user", content: "Zeg alleen: hallo" }],
    });
    res.json({ ok: true, message: "Sleutel werkt." });
  } catch (err) {
    res.json({ ok: false, message: mapClaudeError(err) });
  }
});
