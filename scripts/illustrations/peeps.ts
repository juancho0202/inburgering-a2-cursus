/**
 * People for the illustrations, built from Open Peeps (Pablo Stanley, CC0, openpeeps.com).
 * A peep is a pose (or, for a bust, a body) plus a head, a face and optional facial hair and glasses,
 * placed the way the library's own "a person" templates place them. Colours are set per part.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Part, PeepSymbol } from "./peeps-extract.js";

const lib = JSON.parse(readFileSync(path.resolve(import.meta.dirname, "peeps.json"), "utf8")) as Record<string, PeepSymbol>;

export const PEEP_INK = "#2a3142";

export interface Peep {
  /** Standing or sitting: the point under the feet. Bust: the bottom of the body. Always below the middle of the head. */
  x: number;
  y: number;
  /** How tall this person would be standing, on the canvas (so busts and sitting people get the same scale). */
  h: number;
  /** "standing/walking-1", "sitting/mid-1" or a bust body such as "body/Coffee". */
  pose: string;
  head: string;
  face?: string;
  beard?: string;
  glasses?: string;
  /** Mirror the figure (Open Peeps look to the viewer's right; flipped they look left). */
  flip?: boolean;
  /** A child: the head is drawn bigger than a grown-up's, compared to the body (use with a smaller `h`). */
  child?: boolean;
  colors?: Partial<Record<Part, string>>;
}

// Where the library's templates put the head, relative to the pose or body (from "a person/…").
const LAYOUT = {
  standing: { body: [-121, 634], head: [404, 180] },
  sitting: { body: [-81, 637], head: [345, 180] },
  bust: { body: [147, 639], head: [372, 180] },
} as const;
const HEAD_PARTS = { face: [159, 186], beard: [123, 338], glasses: [47, 241] } as const;

/** The colours of the original illustrations, used when a scene does not choose. */
const DEFAULTS: Partial<Record<Part, string>> = { skin: "#d08b5b", white: "#ffffff" };

/** Pieces to leave out, as subpath numbers per layer of a symbol (the logo on the laptop lid). */
const HIDE: Record<string, Partial<Record<Part, number[]>>> = { "body/Macbook": { ink: [8, 9], accent: [2, 3] } };

function use(name: string, dx: number, dy: number, colors: Partial<Record<Part, string>>): string {
  const sym = lib[name];
  if (!sym) throw new Error(`Open Peeps heeft geen onderdeel "${name}"`);
  return `<g transform="translate(${dx} ${dy})">${sym.layers
    .map((l) => {
      const fill = l.part === "ink" ? PEEP_INK : (colors[l.part] ?? DEFAULTS[l.part] ?? l.fill);
      const hide = HIDE[name]?.[l.part];
      const d = hide ? l.d.split(/(?=M)/).filter((_, i) => !hide.includes(i)).join("") : l.d;
      return `<path d="${d}" fill="${fill}"${l.evenodd ? ' fill-rule="evenodd"' : ""}/>`;
    })
    .join("")}</g>`;
}

/** Every point of a symbol's paths (control points included, which is close enough for bounds). */
const pointCache = new Map<string, [number, number][]>();
function points(name: string): [number, number][] {
  let pts = pointCache.get(name);
  if (!pts) {
    pts = [];
    for (const l of lib[name].layers) {
      const nums = l.d.match(/-?\d+(\.\d+)?/g)!.map(Number);
      for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
    }
    pointCache.set(name, pts);
  }
  return pts;
}

const kindOf = (pose: string) => (pose.startsWith("body/") ? "bust" : pose.startsWith("sitting/") ? "sitting" : "standing");
const poseName = (pose: string) => (pose.startsWith("body/") ? pose : `pose/${pose}`);

/** Head top to feet of a standing peep, in library units: the reference for `h`. */
const STANDING = 2950;

/** The transform from library units to the canvas: [scale (negative when flipped), offset x, offset y]. */
function placement(p: Peep): [number, number, number] {
  const kind = kindOf(p.pose);
  const { body, head } = LAYOUT[kind];
  const bottom = body[1] + Math.max(...points(poseName(p.pose)).map(([, y]) => y));
  const cx = head[0] + lib[`head/${p.head}`].w / 2;
  const s = p.h / STANDING;
  const sx = p.flip ? -s : s;
  return [sx, p.x - cx * sx, p.y - bottom * s];
}

export function peep(p: Peep): string {
  const kind = kindOf(p.pose);
  const { body, head: hp } = LAYOUT[kind];
  const colors = p.colors ?? {};
  const headParts =
    use(`head/${p.head}`, 0, 0, colors) +
    (p.beard ? use(`facial-hair/${p.beard}`, ...HEAD_PARTS.beard, colors) : "") +
    use(`face/${p.face ?? "Smile"}`, ...HEAD_PARTS.face, colors) +
    (p.glasses ? use(`accessories/${p.glasses}`, ...HEAD_PARTS.glasses, colors) : "");
  // A child's head grows around the neck (the bottom middle of the head), so it stays on the shoulders.
  const neck = [lib[`head/${p.head}`].w / 2, 520];
  const headScale = p.child ? ` translate(${neck[0]} ${neck[1]}) scale(1.3) translate(${-neck[0]} ${-neck[1]})` : "";
  const inner = use(poseName(p.pose), body[0], body[1], colors) + `<g transform="translate(${hp[0]} ${hp[1]})${headScale}">${headParts}</g>`;
  const [sx, ox, oy] = placement(p);
  return `<g transform="translate(${r(ox)} ${r(oy)}) scale(${r4(sx)} ${r4(Math.abs(sx))})">${inner}</g>`;
}

/**
 * The hand that reaches out furthest in the direction the peep looks (for poses like "robot_dance" or
 * "pointing_finger"), on the canvas.
 * `band` limits the search to a slice of the pose's height (0 = top, 1 = feet), e.g. to skip a raised elbow.
 */
export function reach(p: Peep, band: [number, number] = [0, 0.6]): [number, number] {
  const kind = kindOf(p.pose);
  const { body } = LAYOUT[kind];
  const pts = points(poseName(p.pose));
  const ys = pts.map(([, y]) => y);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const inBand = pts.filter(([, y]) => y >= lo + (hi - lo) * band[0] && y <= lo + (hi - lo) * band[1]);
  const [sx, ox, oy] = placement(p);
  // furthest to the right in library units is furthest forward (a flipped peep looks left)
  const [bx, by] = inBand.reduce((a, b) => (b[0] > a[0] ? b : a));
  return [ox + (bx + body[0]) * sx, oy + (by + body[1]) * Math.abs(sx)];
}

const r = (v: number) => String(Math.round(v * 10) / 10);
const r4 = (v: number) => String(Math.round(v * 10000) / 10000);

/** All parts of one kind, for the gallery. */
export const peepParts = (prefix: string) => Object.keys(lib).filter((k) => k.startsWith(prefix));
