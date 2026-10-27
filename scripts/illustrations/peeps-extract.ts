/**
 * Turns the Open Peeps library (Pablo Stanley, CC0, openpeeps.com) into path data the illustration kit can use.
 * The flat SVGs in the download are black and white only; the colour layers ("✋ Skin", "👕 Top", …) exist
 * only in the Sketch file, so this reads that file and converts every symbol to SVG paths.
 *
 *   npx tsx scripts/illustrations/peeps-extract.ts "path/to/Open Peeps Colour.zip"
 *
 * Writes scripts/illustrations/peeps.json. Needs the `unzip` command. Run it again only to add parts.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/** What a colour layer is, so a scene can give it its own colour. */
export type Part = "ink" | "skin" | "hair" | "top" | "jacket" | "pants" | "shoes" | "scarf" | "white" | "accent";
export interface PeepLayer {
  part: Part;
  fill: string;
  d: string;
  evenodd?: boolean;
}
export interface PeepSymbol {
  w: number;
  h: number;
  layers: PeepLayer[];
}

// ---------- reading the Sketch file ----------

interface Frame { x: number; y: number; width: number; height: number }
interface Pt { point: string; curveFrom: string; curveTo: string; hasCurveFrom: boolean; hasCurveTo: boolean }
interface Layer {
  _class: string;
  name: string;
  frame: Frame;
  layers?: Layer[];
  points?: Pt[];
  isClosed?: boolean;
  isVisible?: boolean;
  booleanOperation?: number;
  rotation?: number;
  isFlippedHorizontal?: boolean;
  isFlippedVertical?: boolean;
  symbolID?: string;
  style?: { fills?: { isEnabled: boolean; fillType?: number; color: { red: number; green: number; blue: number } }[]; windingRule?: number };
}

// Library units are tiny on the canvas (a person is ~3000 units tall), so whole numbers are precise enough.
const num = (v: number) => String(Math.round(v));
const parsePt = (s: string) => s.slice(1, -1).split(",").map(Number) as [number, number];
type Matrix = [number, number, number, number, number, number]; // a b c d e f
const mul = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const apply = (m: Matrix, [x, y]: [number, number]): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

/** The matrix that puts a layer's own coordinates (0..width, 0..height) into its parent's. */
function layerMatrix(l: Layer): Matrix {
  const { x, y, width: w, height: h } = l.frame;
  let m: Matrix = [1, 0, 0, 1, x, y];
  const rot = l.rotation ?? 0;
  if (rot || l.isFlippedHorizontal || l.isFlippedVertical) {
    // rotate/flip around the centre of the frame (Sketch's rotation is counter-clockwise)
    const a = (-rot * Math.PI) / 180;
    const sx = l.isFlippedHorizontal ? -1 : 1;
    const sy = l.isFlippedVertical ? -1 : 1;
    m = mul(m, [1, 0, 0, 1, w / 2, h / 2]);
    m = mul(m, [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]);
    m = mul(m, [sx, 0, 0, sy, -w / 2, -h / 2]);
  }
  return m;
}

function pathData(l: Layer, m: Matrix): string {
  const pts = l.points ?? [];
  if (!pts.length) return "";
  const { width: w, height: h } = l.frame;
  const P = (s: string) => {
    const [px, py] = parsePt(s);
    const [x, y] = apply(m, [px * w, py * h]);
    return `${num(x)} ${num(y)}`;
  };
  let d = `M${P(pts[0].point)}`;
  const count = l.isClosed ? pts.length : pts.length - 1;
  for (let i = 0; i < count; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    d += a.hasCurveFrom || b.hasCurveTo ? `C${P(a.hasCurveFrom ? a.curveFrom : a.point)} ${P(b.hasCurveTo ? b.curveTo : b.point)} ${P(b.point)}` : `L${P(b.point)}`;
  }
  return l.isClosed ? d + "Z" : d;
}

function fillOf(l: Layer): string | null {
  const f = l.style?.fills?.find((x) => x.isEnabled && !x.fillType);
  if (!f) return null;
  const hex = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0");
  return `#${hex(f.color.red)}${hex(f.color.green)}${hex(f.color.blue)}`;
}

function partOf(name: string, fill: string): Part {
  const n = name.toLowerCase();
  if (n.includes("ink") || n === "shape" || fill === "#231f20" || fill === "#000000") return "ink";
  if (n.includes("skin")) return "skin";
  if (n.includes("hair")) return "hair";
  if (n.includes("hijab") || n.includes("turban") || n.includes("bandana")) return "scarf";
  if (n.includes("jacket")) return "jacket";
  if (n.includes("pants") || n.includes("shorts")) return "pants";
  if (n.includes("shoes")) return "shoes";
  if (n.includes("top") || n.includes("clothes")) return "top";
  if (n.includes("eye") || n.includes("teeth")) return "white";
  return "accent";
}

function convert(master: Layer, masters: Map<string, Layer>): PeepSymbol {
  const out: PeepLayer[] = [];
  const walk = (l: Layer, m: Matrix, inherited?: { name: string }) => {
    if (l.isVisible === false) return;
    const lm = mul(m, layerMatrix(l));
    if (l._class === "symbolInstance") {
      const sym = l.symbolID && masters.get(l.symbolID);
      if (!sym) return;
      // a nested symbol is scaled to the instance's frame
      const sx = l.frame.width / sym.frame.width;
      const sy = l.frame.height / sym.frame.height;
      for (const c of sym.layers ?? []) walk(c, mul(lm, [sx, 0, 0, sy, 0, 0]));
      return;
    }
    const fill = fillOf(l);
    if (l._class === "shapeGroup") {
      if (!fill) return;
      // The children form one compound path with the group's winding rule (that is how the line art gets
      // its holes). A subtracted child also becomes a hole with even-odd. Intersections (only in a few
      // hair styles and a hat) are left out.
      const children = (l.layers ?? []).filter((c) => c.isVisible !== false);
      if (children.some((c) => c.booleanOperation === 2)) return;
      const d = children.map((c) => pathData(c, mul(lm, layerMatrix(c)))).join("");
      const evenodd = l.style?.windingRule === 1 || children.some((c) => c.booleanOperation === 1);
      if (d) out.push({ part: partOf(inherited?.name ?? l.name, fill), fill, d, ...(evenodd ? { evenodd: true } : {}) });
      return;
    }
    if (l.layers) {
      for (const c of l.layers) walk(c, lm, { name: l.name });
      return;
    }
    if (fill && l.points) {
      const d = pathData(l, lm);
      if (d) out.push({ part: partOf(inherited && /path|fill/i.test(l.name) ? inherited.name : l.name, fill), fill, d, ...(l.style?.windingRule === 1 ? { evenodd: true } : {}) });
    }
  };
  for (const l of master.layers ?? []) walk(l, [1, 0, 0, 1, 0, 0]);
  return { w: Math.round(master.frame.width), h: Math.round(master.frame.height), layers: out };
}

// ---------- main ----------

function main() {
  const zip = process.argv[2];
  if (!zip) throw new Error('Geef het pad naar "Open Peeps Colour.zip" mee.');
  const tmp = mkdtempSync(path.join(tmpdir(), "peeps-"));
  try {
    execFileSync("unzip", ["-q", "-o", "-j", zip, "Open Peeps Colour/open-peeps.sketch", "-d", tmp]);
    execFileSync("unzip", ["-q", "-o", path.join(tmp, "open-peeps.sketch"), "pages/*", "-d", tmp]);
    const masters = new Map<string, Layer & { symbolID: string }>();
    for (const f of readdirSync(path.join(tmp, "pages"))) {
      const page = JSON.parse(readFileSync(path.join(tmp, "pages", f), "utf8")) as { layers: (Layer & { symbolID: string })[] };
      for (const l of page.layers) if (l._class === "symbolMaster") masters.set(l.symbolID, l);
    }
    const result: Record<string, PeepSymbol> = {};
    for (const m of masters.values()) {
      if (/^(a person|mask|face\/With_Mask)/.test(m.name) || m.name.includes("None")) continue;
      result[m.name] = convert(m, masters);
    }
    const file = path.resolve(import.meta.dirname, "peeps.json");
    writeFileSync(file, JSON.stringify(result));
    console.log(`${Object.keys(result).length} onderdelen → ${file} (${Math.round(JSON.stringify(result).length / 1024)} kB)`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

main();
