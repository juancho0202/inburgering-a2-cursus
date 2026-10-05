import fs from "node:fs/promises";
import path from "node:path";
import { buildContentData, contentFromData, type ContentData, type ContentError } from "../shared/content/data.js";
import type { Content } from "../shared/content/types.js";
import { validateContent } from "../shared/content/validate.js";

export const COURSE_DIR = path.resolve("data/course");

/** Reads every .json and .md file under data/course (posix paths relative to it). */
export async function readCourseFiles(dir = COURSE_DIR): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  async function walk(current: string) {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      const rel = path.relative(dir, full).split(path.sep).join("/");
      // data/course/generated is written by the old server version; Claude-made exercises are user data now.
      if (entry.isDirectory()) {
        if (rel !== "generated") await walk(full);
      } else if (/\.(json|md)$/.test(entry.name)) {
        files[rel] = await fs.readFile(full, "utf-8");
      }
    }
  }
  await walk(dir);
  return files;
}

export interface LoadedCourse {
  data: ContentData;
  content: Content;
  /** Parse errors and validation problems, as readable messages. Empty when the course is valid. */
  problems: string[];
  parseErrors: ContentError[];
}

export async function loadCourse(dir = COURSE_DIR): Promise<LoadedCourse> {
  const { data, errors } = buildContentData(await readCourseFiles(dir));
  return { data, content: contentFromData(data), problems: validateContent(data, errors), parseErrors: errors };
}
