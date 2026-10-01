import { Router } from "express";
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

contentRouter.get("/exams", async (_req, res) => {
  const content = await getContent();
  res.json([...content.exams.values()].map((exam) => ({ id: exam.id, skill: exam.skill, title: exam.title, durationMinutes: exam.durationMinutes })));
});

contentRouter.get("/exams/:id", async (req, res) => {
  const content = await getContent();
  const exam = content.exams.get(req.params.id);
  if (!exam) {
    res.status(404).json({ error: { code: "not_found", message: "Dit examen bestaat niet." } });
    return;
  }
  res.json(exam);
});
