import { notFound, type Env } from "./context.js";

export function courseTree(env: Env) {
  const modules = [...env.content.modules.values()].map((mod) => ({
    id: mod.id,
    title: mod.title,
    description: mod.description,
    icon: mod.icon,
    units: mod.units.map((unitId) => {
      const unit = env.content.units.get(unitId);
      return unit
        ? { id: unit.id, title: unit.title, estimatedMinutes: unit.estimatedMinutes, stepCount: unit.steps.length }
        : { id: unitId, title: "(ontbreekt)", estimatedMinutes: 0, stepCount: 0 };
    }),
  }));
  return { id: env.content.course.id, title: env.content.course.title, modules };
}

export function getUnit(env: Env, unitId: string) {
  const unit = env.content.units.get(unitId);
  if (!unit) throw notFound("Deze les bestaat niet.");
  return unit;
}

export const samenvatting = (env: Env) => ({ md: env.content.samenvatting });
