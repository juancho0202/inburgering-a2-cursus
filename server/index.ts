import express from "express";
import path from "node:path";
import fs from "node:fs";
import { contentRouter } from "./routes/content.js";
import { progressRouter } from "./routes/progress.js";
import { settingsRouter } from "./routes/settings.js";
import { writingRouter } from "./routes/writing.js";
import { claudeRouter } from "./routes/claude.js";
import { getContent, reloadContent } from "./db/contentRepo.js";
import { userDir } from "./db/progressRepo.js";
import { maybeMakeDailyBackup } from "./db/fileStore.js";

const PORT = 5174;
const HOST = "127.0.0.1";
const isDev = process.env.NODE_ENV !== "production";

async function main() {
  fs.mkdirSync(path.resolve("data/user"), { recursive: true });
  await maybeMakeDailyBackup(userDir);

  const content = await getContent();
  if (content.errors.length > 0) {
    console.error(`\nContentfouten gevonden (${content.errors.length}):`);
    for (const err of content.errors) console.error(`  ${err.file}\n    ${err.message}`);
    if (isDev) {
      console.error("\nServer start niet. Los de fouten hierboven op.");
      process.exit(1);
    }
  }

  if (isDev) {
    fs.watch(path.resolve("data/course"), { recursive: true }, () => {
      reloadContent()
        .then(() => console.log("[content] herladen"))
        .catch((err) => console.error("[content] fout bij herladen", err));
    });
  }

  const app = express();
  app.use(express.json());

  app.use("/api", contentRouter);
  app.use("/api", progressRouter);
  app.use("/api", settingsRouter);
  app.use("/api", writingRouter);
  app.use("/api", claudeRouter);

  app.get("/api/export", async (_req, res) => {
    res.status(501).json({ error: { code: "not_implemented", message: "Komt in een volgende fase." } });
  });

  if (!isDev) {
    const distDir = path.resolve("dist");
    app.use(express.static(distDir));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(distDir, "index.html")));
  }

  app.listen(PORT, HOST, () => {
    console.log(`API draait op http://${HOST}:${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
