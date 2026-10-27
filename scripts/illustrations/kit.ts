/**
 * The drawing kit for the lesson illustrations (npm run illustrations).
 * Everything returns SVG markup as a string. One style for all scenes: flat colours, people and
 * props with a dark outline, backgrounds without one. The canvas is W × H; the floor/street starts at FLOOR.
 */

export const W = 480;
export const H = 320;
export const FLOOR = 250;

export const INK = "#2a3142";
const SW = 2; // outline width (close to the line weight of the people)

export const C = {
  paper: "#fff8ee",
  wall: "#fde9d3",
  wallBlue: "#e3eef7",
  wallGreen: "#e4f1e4",
  wallLilac: "#ece6f6",
  floor: "#efd2ae",
  floorGrey: "#d9dde3",
  sky: "#d6ebf7",
  cloud: "#ffffff",
  grass: "#9fcf7f",
  grassDark: "#7cb95f",
  street: "#c9ccd2",
  pavement: "#e4e1db",
  water: "#8ec5e6",
  wood: "#c98b52",
  woodDark: "#a46a38",
  white: "#ffffff",
  paperDoc: "#fffdf7",
  brick: "#c4644a",
  brick2: "#a8553f",
  brick3: "#d98c5f",
  // clothes
  orange: "#e8710a",
  sky2: "#4a90d9",
  teal: "#2f9e8f",
  rose: "#e05a6d",
  yellow: "#f2c14e",
  violet: "#7b61c9",
  navy: "#34405a",
  green: "#5aa25a",
  grey: "#b9bfc8",
  denim: "#4d6a9c",
  brown: "#7a5236",
  black: "#3a3a44",
  red: "#d6453d",
};

export const SKIN = ["#f6d2b8", "#e8b48f", "#d08b5b", "#a8693f", "#7a4a2c"];

// ---------- helpers ----------

type Attrs = Record<string, string | number | undefined>;
const n = (v: number) => String(Math.round(v * 10) / 10);
const attrs = (a: Attrs) =>
  Object.entries(a)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}="${typeof v === "number" ? n(v) : v}"`)
    .join(" ");
export const el = (tag: string, a: Attrs, children = "") => (children ? `<${tag} ${attrs(a)}>${children}</${tag}>` : `<${tag} ${attrs(a)}/>`);
const line = { stroke: INK, "stroke-width": SW, "stroke-linejoin": "round", "stroke-linecap": "round" };

export const rect = (x: number, y: number, w: number, h: number, fill: string, r = 0, outline = false) =>
  el("rect", { x, y, width: w, height: h, rx: r || undefined, fill, ...(outline ? line : {}) });
export const circle = (cx: number, cy: number, r: number, fill: string, outline = false) => el("circle", { cx, cy, r, fill, ...(outline ? line : {}) });
export const ellipse = (cx: number, cy: number, rx: number, ry: number, fill: string, outline = false) =>
  el("ellipse", { cx, cy, rx, ry, fill, ...(outline ? line : {}) });
export const path = (d: string, fill: string, outline = false, extra: Attrs = {}) => el("path", { d, fill, ...(outline ? line : {}), ...extra });
export const stroke = (d: string, color = INK, width = SW) =>
  el("path", { d, fill: "none", stroke: color, "stroke-width": width, "stroke-linecap": "round", "stroke-linejoin": "round" });
export const g = (children: string, transform?: string) => el("g", { transform }, children);
export const text = (x: number, y: number, s: string, size = 16, fill = INK, weight = 700, anchor = "middle") =>
  el(
    "text",
    { x, y, "font-size": size, "font-weight": weight, fill, "text-anchor": anchor, "font-family": "ui-rounded, 'SF Pro Rounded', 'Segoe UI', Roboto, sans-serif" },
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;"),
  );

/** A whole scene: background colour, content and an accessible title. */
export function svg(title: string, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img"><title>${title}</title>${rect(0, 0, W, H, C.paper)}${body}</svg>\n`;
}

// ---------- backgrounds ----------

/** Indoor room: wall, floor and a skirting line. */
export const room = (wall = C.wall, floor = C.floor) =>
  rect(0, 0, W, FLOOR, wall) + rect(0, FLOOR, W, H - FLOOR, floor) + rect(0, FLOOR - 4, W, 4, "#00000014");

export const outdoors = (ground = C.grass) => rect(0, 0, W, FLOOR, C.sky) + rect(0, FLOOR, W, H - FLOOR, ground);

export const cloud = (x: number, y: number, s = 1) =>
  g(ellipse(0, 0, 26, 11, C.cloud) + circle(-10, -6, 11, C.cloud) + circle(8, -9, 14, C.cloud), `translate(${n(x)} ${n(y)}) scale(${s})`);

export const sun = (x: number, y: number, r = 18) => circle(x, y, r + 8, "#fbe6a2") + circle(x, y, r, "#f7c948");

export function window(x: number, y: number, w: number, h: number, view: "sky" | "houses" | "trees" = "sky") {
  const inner = rect(x + 6, y + 6, w - 12, h - 12, C.sky);
  let v = "";
  if (view !== "sky") {
    const base = y + h - 6;
    if (view === "houses") for (let i = 0; i < 3; i++) v += gable(x + 10 + i * ((w - 20) / 3), base, (w - 20) / 3 - 4, h * 0.45, [C.brick, C.brick3, C.brick2][i], false);
    else for (let i = 0; i < 3; i++) v += circle(x + 16 + i * ((w - 30) / 2), base - 10, 16, C.grassDark);
  }
  return (
    rect(x, y, w, h, C.white, 4, true) +
    inner +
    cloud(x + w * 0.35, y + h * 0.3, 0.6) +
    `<g clip-path="none">${v}</g>` +
    stroke(`M${n(x + w / 2)} ${n(y + 6)}V${n(y + h - 6)}M${n(x + 6)} ${n(y + h / 2)}H${n(x + w - 6)}`, C.white, 5) +
    rect(x - 4, y + h - 2, w + 8, 7, C.white, 2, true)
  );
}

/** A Dutch canal house with a gable; `outline` false for houses far away. */
export function gable(x: number, base: number, w: number, h: number, color: string, outline = true, style: "step" | "bell" | "point" = "bell", attic = true) {
  const top = base - h;
  const roof = Math.min(w * 0.55, h * 0.35);
  let shape: string;
  if (style === "point") shape = `M${n(x)} ${n(base)}V${n(top + roof)}L${n(x + w / 2)} ${n(top)}L${n(x + w)} ${n(top + roof)}V${n(base)}Z`;
  else if (style === "step") {
    const s = w / 6;
    const r6 = roof / 3;
    shape = `M${n(x)} ${n(base)}V${n(top + roof)}H${n(x + s)}V${n(top + 2 * r6)}H${n(x + 2 * s)}V${n(top + r6)}H${n(x + 2.5 * s)}V${n(top)}H${n(x + 3.5 * s)}V${n(top + r6)}H${n(x + 4 * s)}V${n(top + 2 * r6)}H${n(x + 5 * s)}V${n(top + roof)}H${n(x + w)}V${n(base)}Z`;
  } else
    shape = `M${n(x)} ${n(base)}V${n(top + roof)}C${n(x)} ${n(top + roof * 0.4)} ${n(x + w * 0.3)} ${n(top + roof * 0.5)} ${n(x + w * 0.3)} ${n(top)}H${n(x + w * 0.7)}C${n(x + w * 0.7)} ${n(top + roof * 0.5)} ${n(x + w)} ${n(top + roof * 0.4)} ${n(x + w)} ${n(top + roof)}V${n(base)}Z`;
  let out = path(shape, color, outline);
  if (!outline) {
    // far away: two rows of small windows only
    const ww = w * 0.2;
    for (const fy of [top + roof + 4, top + roof + (h - roof) * 0.45]) for (const fx of [x + w * 0.2, x + w * 0.6]) out += rect(fx, fy, ww, ww * 1.2, "#ffffffaa", 1);
    return out;
  }
  const ww = w * 0.22;
  const rows = Math.max(1, Math.floor((h - roof - 40) / (ww * 1.5 + 8)));
  for (let r = 0; r < rows; r++) {
    const fy = top + roof + 8 + r * (ww * 1.5 + 8);
    for (const fx of [x + w * 0.17, x + w * 0.61]) out += rect(fx, fy, ww, ww * 1.4, C.white, 2, true) + stroke(`M${n(fx + ww / 2)} ${n(fy)}V${n(fy + ww * 1.4)}`, INK, 1.5);
  }
  out += rect(x + w * 0.38, base - 34, w * 0.24, 34, C.navy, 3, true);
  if (attic) out += rect(x + w * 0.4, top + roof * 0.35, w * 0.2, w * 0.14, C.white, w * 0.07, true);
  return out;
}

export const tree = (x: number, base: number, s = 1) =>
  g(rect(-6, -40, 12, 40, C.woodDark, 2, true) + circle(0, -62, 30, C.grassDark, true) + circle(-16, -50, 18, C.grassDark) + circle(14, -48, 18, C.grassDark), `translate(${n(x)} ${n(base)}) scale(${s})`);

export const bush = (x: number, base: number, s = 1) => g(path("M-26 0C-30-20-10-30 0-24C10-34 32-22 26 0Z", C.grassDark, true), `translate(${n(x)} ${n(base)}) scale(${s})`);

export function windmill(x: number, base: number, s = 1) {
  const blade = (a: number) => g(rect(-3, -70, 6, 70, C.woodDark, 2, true) + rect(-14, -66, 11, 50, C.white, 1, true), `rotate(${a})`);
  return g(
    path("M-22 0L-14-80H14L22 0Z", C.brick2, true) +
      path("M-18-78L0-100L18-78Z", C.navy, true) +
      rect(-6, -22, 12, 22, C.navy, 5, true) +
      g(blade(20) + blade(110) + blade(200) + blade(290) + circle(0, 0, 5, C.navy, true), "translate(0 -84)"),
    `translate(${n(x)} ${n(base)}) scale(${s})`,
  );
}

export const tulips = (x: number, base: number, colors = [C.red, C.yellow, C.rose, C.orange]) =>
  colors
    .map((c, i) => {
      const tx = x + i * 12;
      return stroke(`M${n(tx)} ${n(base)}V${n(base - 22)}`, C.grassDark, 3) + path(`M${n(tx - 6)} ${n(base - 30)}L${n(tx - 6)} ${n(base - 20)}Q${n(tx)} ${n(base - 16)} ${n(tx + 6)} ${n(base - 20)}L${n(tx + 6)} ${n(base - 30)}L${n(tx + 3)} ${n(base - 26)}L${n(tx)} ${n(base - 31)}L${n(tx - 3)} ${n(base - 26)}Z`, c, true);
    })
    .join("");

export function bike(x: number, base: number, color = C.teal, s = 1) {
  const wheel = (cx: number) => circle(cx, -18, 18, "none", true) + circle(cx, -18, 3, INK);
  return g(
    wheel(-30) +
      wheel(30) +
      stroke("M-30-18L-8-18L10-44H-14L-8-18M10-44L30-18M-14-44L-18-52M-24-52H-12M10-44L8-56H18", color, 4) +
      rect(-24, -56, 14, 5, INK, 2),
    `translate(${n(x)} ${n(base)}) scale(${s})`,
  );
}

export const plant = (x: number, base: number, s = 1) =>
  g(
    path("M-10-38C-30-60-20-80-4-66C-6-90 14-92 12-66C26-82 38-62 14-40Z", C.grassDark, true) + path("M-14 0L-17-26H17L14 0Z", C.brick3, true),
    `translate(${n(x)} ${n(base)}) scale(${s})`,
  );

export const lamp = (x: number, y: number) => stroke(`M${n(x)} 0V${n(y - 18)}`, INK, 2) + path(`M${n(x - 18)} ${n(y)}L${n(x - 10)} ${n(y - 18)}H${n(x + 10)}L${n(x + 18)} ${n(y)}Z`, C.yellow, true);

export function clock(x: number, y: number, r = 16, hour = 10, minute = 10) {
  const hand = (deg: number, len: number, w: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return stroke(`M${n(x)} ${n(y)}L${n(x + Math.cos(a) * len)} ${n(y + Math.sin(a) * len)}`, INK, w);
  };
  let ticks = "";
  for (let i = 0; i < 12; i++) {
    const a = (i * 30 * Math.PI) / 180;
    ticks += circle(x + Math.sin(a) * (r - 4), y - Math.cos(a) * (r - 4), i % 3 ? 0.8 : 1.4, INK);
  }
  return circle(x, y, r, C.white, true) + ticks + hand((hour % 12) * 30 + minute / 2, r * 0.5, 2.5) + hand(minute * 6, r * 0.75, 1.8);
}

export function frame(x: number, y: number, w: number, h: number, art: "landscape" | "tulips" = "landscape") {
  const inner =
    art === "landscape"
      ? rect(x + 4, y + 4, w - 8, h - 8, C.sky) + path(`M${n(x + 4)} ${n(y + h - 4)}L${n(x + w * 0.4)} ${n(y + h * 0.45)}L${n(x + w * 0.7)} ${n(y + h * 0.7)}L${n(x + w - 4)} ${n(y + h * 0.5)}V${n(y + h - 4)}Z`, C.grassDark)
      : rect(x + 4, y + 4, w - 8, h - 8, C.white) + tulips(x + w / 2 - 12, y + h - 6, [C.red, C.yellow, C.rose]);
  return rect(x, y, w, h, C.wood, 2, true) + inner;
}

export function shelf(x: number, y: number, w: number, items: string[] = [C.rose, C.sky2, C.yellow, C.teal]) {
  let out = rect(x, y, w, 6, C.wood, 1, true);
  let cx = x + 8;
  for (const [i, c] of items.entries()) {
    const h = 26 + ((i * 7) % 12);
    out += rect(cx, y - h, 11, h, c, 1, true);
    cx += 13;
  }
  return out;
}

// ---------- furniture ----------

export const table = (x: number, y: number, w: number, color = C.wood, legs = true) =>
  (legs ? rect(x + 10, y, 8, H - y, C.woodDark, 0, true) + rect(x + w - 18, y, 8, H - y, C.woodDark, 0, true) : "") + rect(x, y - 8, w, 12, color, 3, true);

/** Front of a shop or office counter (hides the legs of whoever stands behind it). */
export const counter = (x: number, y: number, w: number, color = C.wood, top = C.woodDark) =>
  rect(x, y, w, H - y + 4, color, 0, true) + rect(x - 6, y - 8, w + 12, 12, top, 3, true);

export const chairBack = (x: number, y: number, color = C.woodDark) => rect(x - 22, y, 44, 70, color, 8, true);

export const door = (x: number, base: number, w = 56, h = 120, color = C.teal) =>
  rect(x, base - h, w, h, color, 4, true) + rect(x + 8, base - h + 10, w - 16, h * 0.35, "#ffffff66", 3) + circle(x + w - 12, base - h / 2, 3.5, C.yellow, true);

export function whiteboard(x: number, y: number, w: number, h: number, lines: string[] = []) {
  let out = rect(x, y, w, h, C.white, 4, true) + rect(x + w * 0.1, y + h, w * 0.8, 6, C.grey, 2, true);
  lines.forEach((l, i) => (out += text(x + 14, y + 28 + i * 24, l, 17, i === 0 ? C.sky2 : INK, 700, "start")));
  return out;
}

// ---------- props ----------

export const cup = (x: number, y: number, color = C.white) =>
  path(`M${n(x - 8)} ${n(y - 16)}H${n(x + 8)}L${n(x + 6)} ${n(y)}H${n(x - 6)}Z`, color, true) + stroke(`M${n(x + 7)} ${n(y - 13)}c7 0 7 8 0 8`) + stroke(`M${n(x - 3)} ${n(y - 22)}q3 -4 0 -8M${n(x + 3)} ${n(y - 22)}q3 -4 0 -8`, "#c9b8a6", 1.6);

export const laptop = (x: number, y: number, flip = false) =>
  g(path("M-34 0L-28-40H28L34 0Z", C.grey, true) + rect(-24, -36, 48, 30, C.sky, 2) + rect(-40, -2, 80, 6, C.grey, 2, true), `translate(${n(x)} ${n(y)})${flip ? " scale(-1 1)" : ""}`);

export const phone = (x: number, y: number, a = 0) => g(rect(-5, -9, 10, 18, INK, 2) + rect(-3.5, -6.5, 7, 12, C.sky, 1), `translate(${n(x)} ${n(y)}) rotate(${a})`);

export function letter(x: number, y: number, a = 0, w = 30, h = 38) {
  let lines = "";
  for (let i = 0; i < 4; i++) lines += stroke(`M${n(-w / 2 + 5)} ${n(-h / 2 + 8 + i * 7)}H${n(w / 2 - 5 - (i === 3 ? 8 : 0))}`, C.grey, 2);
  return g(rect(-w / 2, -h / 2, w, h, C.paperDoc, 2, true) + lines, `translate(${n(x)} ${n(y)}) rotate(${a})`);
}

export const envelope = (x: number, y: number, w = 34, h = 22, color = C.white) =>
  rect(x - w / 2, y - h / 2, w, h, color, 2, true) + stroke(`M${n(x - w / 2)} ${n(y - h / 2)}L${n(x)} ${n(y + 2)}L${n(x + w / 2)} ${n(y - h / 2)}`, INK, 2);

export const book = (x: number, y: number, color = C.rose) => path(`M${n(x - 20)} ${n(y)}L${n(x - 18)} ${n(y - 6)}H${n(x + 18)}L${n(x + 20)} ${n(y)}Z`, color, true) + rect(x - 20, y, 40, 4, C.white, 1, true);

export const openBook = (x: number, y: number) =>
  path(`M${n(x)} ${n(y)}C${n(x - 12)} ${n(y - 6)} ${n(x - 26)} ${n(y - 6)} ${n(x - 34)} ${n(y - 2)}V${n(y - 26)}C${n(x - 26)} ${n(y - 30)} ${n(x - 12)} ${n(y - 30)} ${n(x)} ${n(y - 24)}C${n(x + 12)} ${n(y - 30)} ${n(x + 26)} ${n(y - 30)} ${n(x + 34)} ${n(y - 26)}V${n(y - 2)}C${n(x + 26)} ${n(y - 6)} ${n(x + 12)} ${n(y - 6)} ${n(x)} ${n(y)}Z`, C.white, true) +
  stroke(`M${n(x)} ${n(y - 24)}V${n(y)}M${n(x - 28)} ${n(y - 20)}H${n(x - 8)}M${n(x - 28)} ${n(y - 13)}H${n(x - 8)}M${n(x + 8)} ${n(y - 20)}H${n(x + 28)}M${n(x + 8)} ${n(y - 13)}H${n(x + 28)}`, C.grey, 1.6);

export const box = (x: number, base: number, w = 56, h = 44, label?: string) =>
  rect(x, base - h, w, h, "#d9a066", 2, true) + stroke(`M${n(x)} ${n(base - h + 12)}H${n(x + w)}`, INK, 1.6) + rect(x + w / 2 - 6, base - h, 12, 12, "#e8c08f") + (label ? text(x + w / 2, base - h / 2 + 8, label, 11, INK, 700) : "");

export const plate = (x: number, y: number) => ellipse(x, y, 20, 5, C.white, true);

export const bottle = (x: number, y: number, color = C.teal) => path(`M${n(x - 6)} ${n(y)}V${n(y - 22)}Q${n(x - 6)} ${n(y - 28)} ${n(x - 2)} ${n(y - 30)}V${n(y - 38)}H${n(x + 2)}V${n(y - 30)}Q${n(x + 6)} ${n(y - 28)} ${n(x + 6)} ${n(y - 22)}V${n(y)}Z`, color, true);

export const pan = (x: number, y: number) => path(`M${n(x - 18)} ${n(y - 14)}H${n(x + 18)}V${n(y - 4)}Q${n(x + 18)} ${n(y)} ${n(x + 14)} ${n(y)}H${n(x - 14)}Q${n(x - 18)} ${n(y)} ${n(x - 18)} ${n(y - 4)}Z`, C.navy, true) + stroke(`M${n(x + 18)} ${n(y - 11)}H${n(x + 34)}`, INK, 4);

export function crate(x: number, base: number, fruit: string, w = 64) {
  let fr = "";
  for (let i = 0; i < 5; i++) fr += circle(x + 8 + i * ((w - 16) / 4), base - 26 - (i % 2) * 5, 8, fruit, true);
  return fr + rect(x, base - 24, w, 24, C.wood, 2, true) + stroke(`M${n(x)} ${n(base - 12)}H${n(x + w)}`, INK, 1.6);
}

export const priceTag = (x: number, y: number, label: string) =>
  stroke(`M${n(x)} ${n(y)}V${n(y + 12)}`, INK, 2) + rect(x - 22, y - 16, 44, 18, C.white, 3, true) + text(x, y - 3, label, 11, INK, 800);

export const sign = (x: number, y: number, w: number, label: string, fill = C.navy, color = C.white, size = 14) =>
  rect(x, y, w, size + 12, fill, 4, true) + text(x + w / 2, y + size + 4, label, size, color, 800);

/** A speech bubble; with `think` (the head of the thinker) it becomes a thought bubble with little circles instead of a tail. */
export function bubble(x: number, y: number, label: string, opts: { size?: number; tail?: "left" | "right" | "down"; fill?: string; w?: number; think?: [number, number] } = {}) {
  const size = opts.size ?? 16;
  const w = opts.w ?? Math.max(44, label.length * size * 0.58 + 22);
  const h = size + 18;
  const tail = opts.tail ?? "down";
  const tx = tail === "left" ? x - w / 2 + 16 : tail === "right" ? x + w / 2 - 16 : x;
  const td = tail === "left" ? -8 : tail === "right" ? 8 : 0;
  const t = opts.think ? 0 : 1; // no tail on a thought bubble
  let dots = "";
  if (opts.think) {
    const [px, py] = opts.think;
    const at = (f: number) => [x + (px - x) * f, y + 6 + (py - y - 6) * f];
    dots = circle(at(0.3)[0], at(0.3)[1], 5, opts.fill ?? C.white, true) + circle(at(0.65)[0], at(0.65)[1], 3, opts.fill ?? C.white, true);
  }
  return (
    path(
      `M${n(x - w / 2 + 10)} ${n(y - h)}H${n(x + w / 2 - 10)}Q${n(x + w / 2)} ${n(y - h)} ${n(x + w / 2)} ${n(y - h + 10)}V${n(y - 10)}Q${n(x + w / 2)} ${n(y)} ${n(x + w / 2 - 10)} ${n(y)}H${n(tx + 7 * t)}L${n(tx + td * t)} ${n(y + 10 * t)}L${n(tx - 7 * t)} ${n(y)}H${n(x - w / 2 + 10)}Q${n(x - w / 2)} ${n(y)} ${n(x - w / 2)} ${n(y - 10)}V${n(y - h + 10)}Q${n(x - w / 2)} ${n(y - h)} ${n(x - w / 2 + 10)} ${n(y - h)}Z`,
      opts.fill ?? C.white,
      true,
    ) +
    text(x, y - h / 2 + size * 0.36, label, size) +
    dots
  );
}

/** Sound going out: arcs that open to the right (dir 1) or the left (dir -1). */
export function waves(x: number, y: number, dir = 1, s = 1, color = C.orange) {
  return [10, 20, 30]
    .map((r) => {
      const rr = r * s;
      return stroke(`M${x + dir * rr * 0.5} ${y - rr * 0.87}A${rr} ${rr} 0 0 ${dir > 0 ? 1 : 0} ${x + dir * rr * 0.5} ${y + rr * 0.87}`, color, 3);
    })
    .join("");
}

/** A loudspeaker horn, the kind on a platform or in a hall. */
export function horn(x: number, y: number, dir = 1, s = 1) {
  return g(path("M0 -8H14L40 -24V24L14 8H0Z", C.grey, true) + rect(-8, -10, 10, 20, C.navy, 2, true) + waves(48, 0, 1, 0.9, C.orange), `translate(${x} ${y}) scale(${dir * s} ${s})`);
}

export function radioSet(x: number, base: number, s = 1) {
  return g(
    stroke("M30 -64L58 -100", INK, 3) +
      circle(58, -100, 3, INK) +
      rect(-60, -66, 120, 66, C.red, 10, true) +
      rect(-50, -56, 52, 46, "#7a2e2a", 6) +
      [0, 1, 2, 3].map((i) => stroke(`M-46 ${-48 + i * 11}H-2`, "#ffffff55", 2)).join("") +
      rect(12, -56, 38, 16, C.paperDoc, 3, true) +
      stroke("M20 -48H42", C.grey, 2) +
      circle(22, -22, 8, C.yellow, true) +
      circle(42, -22, 8, C.yellow, true) +
      rect(-48, 0, 12, 6, INK, 2) +
      rect(36, 0, 12, 6, INK, 2),
    `translate(${x} ${base - 6 * s}) scale(${s})`,
  );
}

export const heart = (x: number, y: number, s = 1, color = C.rose) => g(path("M0 6C-14-4-8-16 0-8C8-16 14-4 0 6Z", color, true), `translate(${n(x)} ${n(y)}) scale(${s})`);
