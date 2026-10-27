/** Scenes for the Basis lessons (grammar and everyday words). */
import {
  C, FLOOR, H, INK, SKIN, W, book, bubble, circle, clock, cloud, counter, cup, door, ellipse, frame, g, lamp, outdoors, path, plant, rect, room, shelf,
  sign, stroke, table, text, tree, bush, window, whiteboard,
} from "./kit.js";
import { peep, reach, type Peep } from "./peeps.js";
import type { Scene } from "./scenes.js";

const TALL = 236;

// ---------- props ----------

/** A word on a little card with a line to the thing it names, like the labelled pictures in a word book. */
function label(x: number, y: number, word: string, tx: number, ty: number) {
  const w = word.length * 7.6 + 16;
  return stroke(`M${x} ${y}L${tx} ${ty}`, INK, 1.4) + circle(tx, ty, 2.5, INK) + rect(x - w / 2, y - 11, w, 22, C.white, 5, true) + text(x, y + 5, word, 13, INK, 700);
}

function sofa(x: number, seat: number, w: number, color: string) {
  return (
    rect(x, seat - 72, w, 80, color, 14, true) +
    rect(x + 8, seat - 4, w - 16, 30, color, 8, true) +
    rect(x - 12, seat - 40, 28, 70, color, 10, true) +
    rect(x + w - 16, seat - 40, 28, 70, color, 10, true) +
    rect(x + 4, seat + 30, 8, 12, C.woodDark) +
    rect(x + w - 12, seat + 30, 8, 12, C.woodDark)
  );
}

const rug = (cx: number, cy: number, rx: number, ry: number, color = C.rose) => ellipse(cx, cy, rx, ry, color, true) + ellipse(cx, cy, rx - 10, ry - 5, "none", true);

function tv(x: number, y: number) {
  return rect(x, y, 96, 60, INK, 5) + rect(x + 5, y + 5, 86, 50, C.sky2, 2) + path(`M${x + 5} ${y + 55}L${x + 40} ${y + 26}L${x + 60} ${y + 42}L${x + 91} ${y + 18}V${y + 55}Z`, C.teal) + rect(x + 40, y + 60, 16, 10, INK);
}

/** A dog seen from the side, looking right; `base` is where the paws stand. */
function dog(x: number, base: number, color = "#c98b52", s = 1, flip = false) {
  const leg = (lx: number) => rect(lx, -24, 7, 24, color, 3, true);
  return g(
    leg(-24) +
      leg(10) +
      stroke("M-28-34Q-40-44-36-56", INK, 6) +
      stroke("M-28-34Q-40-44-36-56", color, 3) +
      path("M-30-42Q-30-50-20-50H14Q26-50 26-38V-30Q26-22 16-22H-20Q-30-22-30-32Z", color, true) +
      leg(-16) +
      leg(18) +
      path("M16-44Q14-62 28-64Q42-64 44-52L48-48Q50-42 42-42H30Q22-40 18-36Z", color, true) +
      path("M24-62Q14-62 16-48Q24-50 28-58Z", "#8a5a30", true) +
      circle(36, -56, 1.8, INK) +
      ellipse(48, -48, 3, 2.4, INK) +
      rect(16, -44, 8, 5, C.red, 1, true),
    `translate(${x} ${base}) scale(${flip ? -s : s} ${s})`,
  );
}

function fridge(x: number, base: number, open = true) {
  const w = 96;
  const h = 170;
  let out = rect(x, base - h, w, h, C.white, 6, true);
  if (!open) return out + stroke(`M${x} ${base - h + 56}H${x + w}`, INK, 2) + rect(x + w - 14, base - h + 70, 5, 30, C.grey, 2, true);
  out += rect(x + 6, base - h + 6, w - 12, h - 12, "#eef6fb", 3);
  for (const y of [base - 110, base - 64]) out += rect(x + 6, y, w - 12, 4, C.grey);
  // almost empty: a little cheese, a jar and an egg box
  out += path(`M${x + 14} ${base - 114}l26-14v14z`, C.yellow, true) + rect(x + 58, base - 132, 18, 22, C.rose, 3, true) + rect(x + 18, base - 80, 46, 14, C.paperDoc, 2, true);
  // the open door, seen from the side
  out += path(`M${x + w} ${base - h}L${x + w + 40} ${base - h + 14}V${base - 6}L${x + w} ${base}Z`, C.white, true) + rect(x + w + 8, base - 120, 28, 4, C.grey) + rect(x + w + 8, base - 70, 28, 4, C.grey);
  return out;
}

function bed(x: number, top: number, w: number) {
  return rect(x - 10, top - 70, 18, 120, C.woodDark, 4, true) + rect(x, top, w, 34, C.white, 6, true) + path(`M${x + 50} ${top - 6}H${x + w}V${top + 34}H${x + 30}Q${x + 40} ${top + 10} ${x + 50} ${top - 6}Z`, C.sky2, true) + ellipse(x + 26, top - 4, 24, 10, C.white, true) + rect(x + 6, top + 34, 8, 26, C.woodDark) + rect(x + w - 14, top + 34, 8, 26, C.woodDark);
}

function alarmClock(x: number, y: number) {
  return circle(x - 13, y - 26, 6, C.red, true) + circle(x + 13, y - 26, 6, C.red, true) + rect(x - 22, y - 26, 44, 26, C.red, 8, true) + rect(x - 16, y - 21, 32, 16, C.white, 3) + text(x, y - 8, "7:00", 11, INK, 800) + stroke(`M${x - 30} ${y - 34}l-6-4M${x + 30} ${y - 34}l6-4M${x - 32} ${y - 24}h-7M${x + 32} ${y - 24}h7`, INK, 2);
}

function rack(x: number, y: number, w: number, colors: string[]) {
  let out = stroke(`M${x} ${y}H${x + w}M${x + 6} ${y}V${FLOOR + 30}M${x + w - 6} ${y}V${FLOOR + 30}`, C.grey, 5) + stroke(`M${x} ${y}H${x + w}`, INK, 1.5);
  colors.forEach((c, i) => {
    const cx = x + 22 + i * ((w - 44) / (colors.length - 1));
    out += stroke(`M${cx} ${y}v8`, INK, 1.5) + path(`M${cx - 18} ${y + 14}L${cx} ${y + 8}L${cx + 18} ${y + 14}L${cx + 20} ${y + 96}H${cx - 20}Z`, c, true) + stroke(`M${cx} ${y + 14}V${y + 96}`, INK, 1.2);
  });
  return out;
}

function mirror(x: number, base: number) {
  return rect(x, base - 170, 64, 160, C.wood, 30, true) + rect(x + 7, base - 163, 50, 146, "#dcecf5", 24) + stroke(`M${x + 18} ${base - 140}l14-14M${x + 18} ${base - 120}l24-24`, C.white, 3) + rect(x + 14, base - 12, 36, 12, C.woodDark, 2, true);
}

function register(x: number, y: number, amount: string) {
  return rect(x, y - 44, 70, 44, C.grey, 5, true) + rect(x + 8, y - 70, 54, 26, INK, 4) + text(x + 35, y - 52, amount, 13, "#7cf2a0", 800) + rect(x + 10, y - 36, 50, 22, C.white, 2, true) + rect(x + 74, y - 30, 22, 30, INK, 4) + rect(x + 78, y - 26, 14, 8, C.sky, 1);
}

function album(x: number, y: number) {
  const photo = (px: number, py: number, a: number, sky: string) => g(rect(-16, -12, 32, 26, C.white, 1, true) + rect(-12, -8, 24, 14, sky) + path("M-12 6L-4-2L2 4L6 0L12 6Z", C.grassDark), `translate(${px} ${py}) rotate(${a})`);
  return path(`M${x - 70} ${y}L${x - 64} ${y - 50}H${x}L${x + 64} ${y - 50}L${x + 70} ${y}Z`, "#6d4c8a", true) + path(`M${x - 64} ${y - 4}L${x - 60} ${y - 46}H${x - 2}V${y - 4}ZM${x + 2} ${y - 4}V${y - 46}H${x + 60}L${x + 64} ${y - 4}Z`, C.paperDoc, true) + photo(x - 32, y - 26, -4, "#e8d7b0") + photo(x + 32, y - 26, 3, C.sky);
}

function rainWindow(x: number, y: number, w: number, h: number) {
  let drops = "";
  for (let i = 0; i < 18; i++) {
    const dx = x + 10 + ((i * 37) % (w - 20));
    const dy = y + 12 + ((i * 53) % (h - 30));
    drops += stroke(`M${dx} ${dy}l-4 10`, "#7aa6c8", 2);
  }
  return rect(x, y, w, h, C.white, 4, true) + rect(x + 6, y + 6, w - 12, h - 12, "#b9c7d3") + cloud(x + w * 0.3, y + 30, 0.8).replace(/#ffffff/g, "#9aa8b5") + cloud(x + w * 0.72, y + 44, 0.7).replace(/#ffffff/g, "#8d9aa6") + drops + stroke(`M${x + w / 2} ${y + 6}V${y + h - 6}M${x + 6} ${y + h / 2}H${x + w - 6}`, C.white, 5) + rect(x - 4, y + h - 2, w + 8, 7, C.white, 2, true);
}

/** An exam paper with a pencil, lying on a desk. */
const exam = (x: number, y: number) =>
  path(`M${x - 22} ${y}L${x - 16} ${y - 12}H${x + 22}L${x + 16} ${y}Z`, C.white, true) + stroke(`M${x - 12} ${y - 8}H${x + 12}M${x - 14} ${y - 4}H${x + 6}`, C.grey, 1.4) + stroke(`M${x + 18} ${y - 2}l14-6`, C.yellow, 3);

const umbrella = (x: number, y: number) => stroke(`M${x} ${y}V${y + 50}q0 8-7 8`, INK, 2.5) + path(`M${x - 34} ${y + 6}Q${x} ${y - 30} ${x + 34} ${y + 6}Q${x + 22} ${y - 2} ${x + 11} ${y + 6}Q${x} ${y - 2} ${x - 11} ${y + 6}Q${x - 22} ${y - 2} ${x - 34} ${y + 6}Z`, C.red, true);

// ---------- scenes ----------

const woonkamer: Scene = {
  alt: "Een woonkamer met woordjes: de bank, de lamp, het raam, het schilderij, de tafel en de plant.",
  draw: () =>
    room(C.wallGreen) +
    window(40, 40, 110, 110, "houses") +
    frame(330, 60, 80, 60) +
    lamp(240, 20) +
    sofa(200, 200, 200, C.orange) +
    plant(440, FLOOR + 14, 1.1) +
    rug(220, 290, 140, 18) +
    table(150, 270, 140) +
    cup(190, 262, C.white) +
    book(240, 262, C.sky2) +
    label(170, 26, "de lamp", 228, 36) +
    label(96, 172, "het raam", 96, 146) +
    label(370, 30, "het schilderij", 370, 66) +
    label(270, 106, "de bank", 280, 150) +
    label(100, 236, "de tafel", 160, 266) +
    label(440, 146, "de plant", 444, 186),
};

const familie: Scene = {
  alt: "Een familie: vader, moeder, oma en de zoon.",
  draw: () => {
    const oma: Peep = { x: 84, y: 306, h: 222, pose: "standing/blazer-3", head: "Gray Bun", glasses: "Glasses 2", colors: { skin: SKIN[2], hair: "#e8e1e1", jacket: C.violet, top: C.white, pants: C.navy } };
    const dad: Peep = { x: 200, y: 306, h: TALL, pose: "standing/crossed_arms-1", head: "Short 3", beard: "Goatee 1", colors: { skin: SKIN[2], top: C.teal, pants: C.denim } };
    const kid: Peep = { x: 290, y: 306, h: 150, child: true, pose: "standing/shirt-3", head: "Short 5", face: "Cute", colors: { skin: SKIN[2], top: C.yellow, pants: C.navy } };
    const mom: Peep = { x: 390, y: 306, h: 228, pose: "standing/resting-1", head: "Long", flip: true, colors: { skin: SKIN[1], top: C.rose, pants: C.navy } };
    return (
      outdoors() +
      cloud(260, 34) +
      tree(450, FLOOR + 6, 0.9) +
      bush(30, FLOOR + 4) +
      peep(oma) +
      peep(dad) +
      peep(mom) +
      peep(kid) +
      label(84, 30, "mijn oma", 84, 64) +
      label(200, 22, "mijn vader", 200, 56) +
      label(296, 120, "ik", 292, 146) +
      label(392, 30, "mijn moeder", 392, 62)
    );
  },
};

const kassa: Scene = {
  alt: "Een man betaalt bij de kassa van de supermarkt.",
  draw: () => {
    const top = 214;
    const cashier: Peep = { x: 340, y: top + 8, h: 330, pose: "body/Explaining", head: "Medium Bangs", face: "Explaining", flip: true, colors: { skin: SKIN[3], top: C.red } };
    const cu: Peep = { x: 120, y: 310, h: TALL, pose: "standing/robot_dance-1", head: "Short 1", glasses: "Glasses", colors: { skin: SKIN[0], top: C.green, pants: C.navy } };
    const [hx, hy] = reach(cu);
    let shelves = "";
    for (const y of [70, 120]) {
      shelves += rect(0, y, 150, 5, C.wood, 1, true);
      for (let i = 0; i < 6; i++) shelves += rect(8 + i * 24, y - 26, 18, 26, [C.yellow, C.red, C.sky, C.green][i % 4], 2, true);
    }
    return (
      room(C.wall, C.floorGrey) +
      shelves +
      sign(300, 20, 120, "KASSA 2", C.red, C.white, 15) +
      peep(cashier) +
      counter(200, top, 280, C.grey, C.navy) +
      register(380, top - 4, "€ 12,45") +
      rect(220, top - 22, 30, 18, C.yellow, 3, true) +
      rect(256, top - 30, 18, 26, C.white, 3, true) +
      circle(292, top - 12, 9, C.orange, true) +
      peep(cu) +
      rect(hx - 4, hy - 12, 20, 26, INK, 3) +
      rect(hx - 2, hy - 8, 16, 18, C.sky, 2) +
      bubble(120, 48, "Ik wil pinnen.", { tail: "down", size: 15 }) +
      bubble(340, 96, "Dat is € 12,45.", { tail: "down", size: 14 })
    );
  },
};

const koelkast: Scene = {
  alt: "Een man kijkt in de koelkast. Er is geen melk.",
  draw: () => {
    const p: Peep = { x: 170, y: 306, h: TALL, pose: "standing/blazer-4", head: "Shaved 2", face: "Concerned", beard: "Moustache 1", colors: { skin: SKIN[3], top: C.white, jacket: C.sky2, pants: C.navy } };
    return (
      room(C.wall) +
      rect(0, 150, 160, 100, C.wood, 0, true) +
      rect(0, 144, 160, 8, C.woodDark, 2, true) +
      window(40, 34, 90, 90, "trees") +
      clock(430, 50, 18, 7, 45) +
      fridge(290, FLOOR + 10) +
      peep(p) +
      bubble(180, 46, "Er is geen melk!", { tail: "down", size: 16 })
    );
  },
};

const hond: Scene = {
  alt: "Een vrouw loopt met haar hond in het park. Op het bord staat: honden moeten aan de lijn.",
  draw: () => {
    const p: Peep = { x: 200, y: 304, h: TALL, pose: "standing/walking-1", head: "Medium 3", colors: { skin: SKIN[1], top: C.orange, pants: C.denim } };
    const [hx, hy] = reach(p, [0.35, 0.6]);
    return (
      outdoors() +
      cloud(80, 40) +
      tree(60, FLOOR + 8, 1.2) +
      tree(440, FLOOR + 8, 1.1) +
      path("M0 290Q240 260 480 286V320H0Z", C.pavement) +
      stroke("M370 260V160", INK, 4) +
      rect(310, 96, 120, 70, C.white, 6, true) +
      text(370, 118, "Honden", 14, INK, 800) +
      text(370, 136, "moeten aan", 13, INK, 700) +
      text(370, 154, "de lijn", 13, INK, 700) +
      peep(p) +
      dog(290, 300, "#c98b52", 0.9) +
      stroke(`M${hx} ${hy}Q${(hx + 302) / 2} ${hy + 40} 302 ${300 - 40 * 0.9}`, C.red, 1.8)
    );
  },
};

const fotoalbum: Scene = {
  alt: "Een oma laat haar kleindochter oude foto's zien. Vroeger woonde ze in een ander land.",
  draw: () => {
    const top = 230;
    const oma: Peep = { x: 150, y: top + 8, h: 330, pose: "body/Explaining", head: "Gray Medium", glasses: "Glasses 5", face: "Explaining", colors: { skin: SKIN[3], hair: "#d9d9d9", top: C.violet } };
    const kid: Peep = { x: 320, y: top + 8, h: 300, child: true, pose: "body/Tee 1", head: "Bun", face: "Awe", flip: true, colors: { skin: SKIN[3], top: C.yellow } };
    return (
      room(C.wallLilac) +
      frame(60, 40, 70, 54) +
      frame(380, 50, 60, 70, "tulips") +
      shelf(200, 80, 80) +
      lamp(250, 20).replace(/M250 0V2/, "M250 0V2") +
      peep(oma) +
      peep(kid) +
      table(60, top, 360) +
      album(240, top - 4) +
      bubble(150, 64, "Vroeger woonde ik hier.", { tail: "down", size: 14 })
    );
  },
};

const ochtend: Scene = {
  alt: "Het is zeven uur. Een vrouw staat op. De wekker gaat.",
  draw: () => {
    const p: Peep = { x: 200, y: 304, h: TALL, pose: "sitting/crossed_legs", head: "Bangs 2", face: "Tired", colors: { skin: SKIN[0], top: C.sky, pants: C.sky2 } };
    return (
      room(C.wallBlue) +
      window(320, 40, 110, 100, "sky") +
      path("M330 130A40 40 0 0 1 420 130Z", "#ffd27a").replace("/>", ' opacity="0.9"/>') +
      bed(150, 238, 220) +
      peep(p) +
      rect(60, 210, 70, 60, C.wood, 3, true) +
      rect(64, 270, 8, 30, C.woodDark) +
      rect(118, 270, 8, 30, C.woodDark) +
      alarmClock(96, 210) +
      rug(250, 300, 120, 12, C.yellow) +
      bubble(230, 70, "Ik sta op.", { tail: "down", size: 16 })
    );
  },
};

const kledingwinkel: Scene = {
  alt: "Twee vriendinnen in een kledingwinkel. Een vrouw past een jas.",
  draw: () => {
    const a: Peep = { x: 240, y: 306, h: TALL, pose: "standing/blazer-1", head: "Long Curly", face: "Cute", colors: { skin: SKIN[3], jacket: C.red, top: C.white, pants: C.navy } };
    const b: Peep = { x: 380, y: 306, h: 228, pose: "standing/pointing_finger-1", head: "Hijab", face: "Smile", flip: true, colors: { skin: SKIN[1], scarf: C.teal, top: C.yellow, pants: C.denim } };
    return (
      room(C.wall, C.floorGrey) +
      rack(20, 90, 170, [C.sky2, C.green, C.rose, C.navy]) +
      mirror(150, FLOOR + 30) +
      sign(30, 54, 110, "UITVERKOOP", C.red, C.white, 13) +
      peep(a) +
      peep(b) +
      bubble(372, 98, "Die jas is mooier!", { tail: "down", size: 14 }) +
      bubble(232, 46, "Is hij niet te groot?", { tail: "down", size: 14 })
    );
  },
};

const regen: Scene = {
  alt: "Het regent. Een man kijkt uit het raam en blijft thuis.",
  draw: () => {
    const top = 238;
    const p: Peep = { x: 290, y: top + 8, h: 340, pose: "body/Coffee", head: "Twists 2", face: "Concerned", flip: true, colors: { skin: SKIN[4], top: C.sky2 } };
    return (
      room(C.wallBlue) +
      rainWindow(110, 40, 150, 150) +
      shelf(372, 112, 70) +
      plant(440, FLOOR + 14) +
      peep(p) +
      table(60, top, 360) +
      book(390, top - 4) +
      bubble(300, 46, "Ik blijf thuis, omdat het regent.", { size: 13, think: [292, 92] })
    );
  },
};

const examen: Scene = {
  alt: "Een examenzaal. Cursisten maken het examen. Er staat een klok aan de muur.",
  draw: () => {
    const top = 250;
    const s = (x: number, pose: string, head: string, colors: Peep["colors"]) =>
      peep({ x, y: top + 8, h: 300, pose, head, face: "Driven", colors });
    const sup: Peep = { x: 420, y: 296, h: 222, pose: "standing/crossed_arms-2", head: "Short 1", glasses: "Glasses 3", flip: true, colors: { skin: SKIN[0], top: C.navy, pants: C.grey } };
    return (
      room(C.wallGreen, C.floorGrey) +
      clock(240, 50, 22, 10, 0) +
      whiteboard(60, 30, 120, 70, ["Examen", "Stilte!"]) +
      sign(300, 34, 96, "Lezen A2", C.navy, C.white, 13) +
      s(80, "body/Button Shirt 2", "Hijab", { skin: SKIN[2], scarf: C.violet, top: C.rose }) +
      s(200, "body/Striped Tee", "Short 2", { skin: SKIN[4], top: C.orange }) +
      s(320, "body/Tee 1", "Long Bangs", { skin: SKIN[0], top: C.teal }) +
      table(20, top, 380, C.white) +
      exam(86, top - 4) +
      exam(206, top - 4) +
      exam(326, top - 4) +
      peep(sup)
    );
  },
};

export const basisScenes: Record<string, Scene> = { woonkamer, familie, kassa, koelkast, hond, fotoalbum, ochtend, kledingwinkel, regen, examen };

void [H, W, door, umbrella];
