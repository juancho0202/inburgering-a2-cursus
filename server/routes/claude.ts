import { Router } from "express";
import { loadSettings } from "../db/progressRepo.js";
import { buildClient } from "../claude/client.js";

export const claudeRouter = Router();

function noKeyResponse(res: import("express").Response) {
  res.status(503).json({
    error: { code: "no_api_key", message: "Voeg een API-sleutel toe bij Instellingen om deze functie te gebruiken." },
  });
}

// Phase 6 implements the real logic for these endpoints.
claudeRouter.post("/claude/feedback-writing", async (_req, res) => {
  const settings = await loadSettings();
  const client = buildClient(settings);
  if (!client) return noKeyResponse(res);
  res.status(501).json({ error: { code: "not_implemented", message: "Komt in een volgende fase." } });
});

claudeRouter.post("/claude/explain", async (_req, res) => {
  const settings = await loadSettings();
  const client = buildClient(settings);
  if (!client) return noKeyResponse(res);
  res.status(501).json({ error: { code: "not_implemented", message: "Komt in een volgende fase." } });
});

claudeRouter.post("/claude/generate", async (_req, res) => {
  const settings = await loadSettings();
  const client = buildClient(settings);
  if (!client) return noKeyResponse(res);
  res.status(501).json({ error: { code: "not_implemented", message: "Komt in een volgende fase." } });
});
