import { contentFromData } from "@shared/content/data";
import type { Content } from "@shared/content/types";

let loading: Promise<{ content: Content; version: string }> | null = null;

/**
 * The course, loaded once. It is bundled into the app at build time (see scripts/vitePluginCourse.ts),
 * validated during the build, and split into its own file so the app shell can start first.
 */
export function loadCourseContent() {
  loading ??= import("virtual:course-data").then((m) => ({ content: contentFromData(m.default), version: m.default.version }));
  return loading;
}
