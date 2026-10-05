import path from "node:path";
import type { Plugin } from "vite";
import { COURSE_DIR, loadCourse } from "./courseFiles.js";

const VIRTUAL_ID = "virtual:course-data";
const RESOLVED_ID = "\0" + VIRTUAL_ID;

/**
 * Bundles the course (data/course) into the app as `virtual:course-data` and validates it first.
 * A broken course file FAILS the build, so a bad deploy cannot reach friends.
 */
export function coursePlugin(): Plugin {
  let isBuild = false;
  return {
    name: "course-data",
    configResolved(config) {
      isBuild = config.command === "build";
    },
    async buildStart() {
      // Validate even if nothing imports the course yet: a broken course file must never reach a deploy.
      if (!isBuild) return;
      const { problems } = await loadCourse();
      if (problems.length) this.error(`De cursusinhoud is niet geldig (${problems.length} fout(en)):\n${problems.map((p) => `- ${p}`).join("\n")}`);
    },
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
    },
    async load(id) {
      if (id !== RESOLVED_ID) return;
      const { data, problems } = await loadCourse();
      if (problems.length) {
        const message = `De cursusinhoud is niet geldig (${problems.length} fout(en)):\n${problems.map((p) => `- ${p}`).join("\n")}`;
        if (isBuild) this.error(message);
        console.error(`\n${message}\n`); // in dev: show the problems but keep serving, so the author can fix them
      }
      return `export default ${JSON.stringify(data)};`;
    },
    configureServer(server) {
      server.watcher.add(COURSE_DIR);
      const onChange = (file: string) => {
        const rel = path.relative(COURSE_DIR, file);
        if (rel.startsWith("..") || rel.startsWith("generated")) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("change", onChange).on("add", onChange).on("unlink", onChange);
    },
  };
}
