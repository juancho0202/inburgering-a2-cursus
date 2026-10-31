/**
 * Draws the illustrations: the scenes (src/assets/scenes/) and the spot illustrations next to exercises
 * (src/assets/spots/), one SVG each, plus an index.json per folder with the alt text of each picture; and the landing
 * page's picture (public/hero.svg) and the maker's portrait on the About page (src/assets/maker.svg).
 * Run: npm run illustrations (add --preview to also write a contact sheet).
 */
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { svg } from "./kit.js";
import { scenes } from "./scenes.js";
import { hero, maker } from "./site-art.js";
import { SH, SW, spots } from "./spots.js";

const ASSETS = path.resolve(import.meta.dirname, "../../src/assets");

const spotSvg = (title: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SW} ${SH}" role="img"><title>${title}</title>${body}</svg>\n`;

async function writeSet(folder: string, items: Record<string, { alt: string; draw: () => string }>, wrap: (alt: string, body: string) => string) {
  const dir = path.join(ASSETS, folder);
  await mkdir(dir, { recursive: true });
  // Remove pictures that no longer exist.
  for (const f of await readdir(dir)) if (f.endsWith(".svg") && !(f.slice(0, -4) in items)) await rm(path.join(dir, f));
  const index: Record<string, string> = {};
  let bytes = 0;
  for (const [id, item] of Object.entries(items)) {
    const out = wrap(item.alt, item.draw());
    bytes += out.length;
    index[id] = item.alt;
    await writeFile(path.join(dir, `${id}.svg`), out);
  }
  await writeFile(path.join(dir, "index.json"), JSON.stringify(index, null, 2) + "\n");
  console.log(`${folder}: ${Object.keys(items).length} illustraties, samen ${Math.round(bytes / 1024)} kB`);
  return dir;
}

async function main() {
  const scenesDir = await writeSet("scenes", scenes, svg);
  const spotsDir = await writeSet("spots", spots, spotSvg);
  // Decorative here: the page or the app gives the alt text.
  await writeFile(path.resolve(ASSETS, "../../public/hero.svg"), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 360">${hero()}</svg>\n`);
  await writeFile(path.join(ASSETS, "maker.svg"), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">${maker()}</svg>\n`);

  if (process.argv.includes("--preview")) {
    const cells = (dir: string, ids: string[], w: number) => ids.map((id) => `<figure><img src="file://${dir}/${id}.svg" width="${w}"><figcaption>${id}</figcaption></figure>`).join("");
    const file = path.join(process.env.PREVIEW_DIR ?? ASSETS, "preview.html");
    await writeFile(
      file,
      `<!doctype html><style>body{margin:16px;font:13px system-ui}section{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:24px}img{display:block;border-radius:12px;background:#fff8ee}figure{margin:0}</style>` +
        `<section>${cells(scenesDir, Object.keys(scenes), 480)}</section><section>${cells(spotsDir, Object.keys(spots), 160)}</section>`,
    );
    console.log(`Voorbeeld: ${file}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
