import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { userDir } from "../db/progressRepo.js";

export const dataRouter = Router();

/** Everything in data/user as one JSON file. The API key is never included. */
dataRouter.get("/export", async (_req, res) => {
  const bundle: Record<string, unknown> = { exportedAt: new Date().toISOString(), files: {} };
  const files = bundle.files as Record<string, unknown>;
  for (const name of await fs.readdir(userDir).catch(() => [] as string[])) {
    const full = path.join(userDir, name);
    const stat = await fs.stat(full).catch(() => null);
    if (!stat?.isFile()) continue;
    const raw = await fs.readFile(full, "utf-8");
    if (name.endsWith(".jsonl")) {
      files[name] = raw.split("\n").filter(Boolean).map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return l;
        }
      });
      continue;
    }
    try {
      const data = JSON.parse(raw);
      if (name === "settings.json" && data && typeof data === "object") data.apiKey = null;
      files[name] = data;
    } catch {
      files[name] = raw;
    }
  }
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="inburgering-a2-${stamp}.json"`);
  res.send(JSON.stringify(bundle, null, 2));
});
