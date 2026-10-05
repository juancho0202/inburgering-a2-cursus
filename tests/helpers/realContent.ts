import type { Content } from "../../shared/content/types";
import { loadCourse } from "../../scripts/courseFiles";

/** The real course from data/course, built the same way as for the app. */
export async function realContent(): Promise<Content> {
  const { content, problems } = await loadCourse();
  if (problems.length) throw new Error(`Content problems: ${problems.slice(0, 3).join(" | ")}`);
  return content;
}
