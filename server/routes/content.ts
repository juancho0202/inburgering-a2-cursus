import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { getContent } from "../db/contentRepo.js";

export const contentRouter = Router();

contentRouter.get("/course", async (_req, res) => {
  const content = await getContent();
  const modules = [...content.modules.values()].map((mod) => ({
    id: mod.id,
    title: mod.title,
    description: mod.description,
    icon: mod.icon,
    units: mod.units.map((unitId) => {
      const unit = content.units.get(unitId);
      return unit
        ? {
            id: unit.id,
            title: unit.title,
            estimatedMinutes: unit.estimatedMinutes,
            stepCount: unit.steps.length,
          }
        : { id: unitId, title: "(ontbreekt)", estimatedMinutes: 0, stepCount: 0 };
    }),
  }));
  res.json({ id: content.course?.id ?? "inburgering-a2", title: content.course?.title ?? "Inburgering A2", modules });
});

contentRouter.get("/units/:unitId", async (req, res) => {
  const content = await getContent();
  const unit = content.units.get(req.params.unitId);
  if (!unit) {
    res.status(404).json({ error: { code: "not_found", message: "Deze les bestaat niet." } });
    return;
  }
  res.json(unit);
});

contentRouter.get("/samenvatting", async (_req, res) => {
  try {
    const md = await fs.readFile(path.resolve("data/course/basis/samenvatting.md"), "utf-8");
    res.json({ md });
  } catch {
    res.status(404).json({ error: { code: "not_found", message: "De samenvatting bestaat niet." } });
  }
});
