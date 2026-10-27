import {
  C, FLOOR, H, INK, SKIN, W, bike, book, bottle, box, bubble, bush, circle, clock, cloud, counter, crate, cup, door, ellipse, envelope, frame, g,
  gable, lamp, laptop, letter, openBook, outdoors, pan, path, phone, plant, plate, priceTag, rect, room, shelf, sign, stroke, sun, table, text, tree,
  tulips, whiteboard, window, windmill,
} from "./kit.js";
import { peep, reach, type Peep } from "./peeps.js";
import { basisScenes } from "./scenes-basis.js";
import { knmScenes } from "./scenes-knm.js";
import { werkWonenScenes } from "./scenes-werk-wonen.js";
import { lezenSchrijvenScenes } from "./scenes-lezen-schrijven.js";
import { luisterenScenes } from "./scenes-luisteren.js";

export interface Scene {
  /** Alt text: what is in the picture, in simple Dutch. */
  alt: string;
  draw: () => string;
}

/** Height of a standing grown-up in the front of a scene. */
const TALL = 236;

// ---------- props that only a few scenes use ----------

function calendar(x: number, y: number, mark = 17) {
  let out = rect(x, y, 84, 74, C.white, 3, true) + rect(x, y, 84, 16, C.red, 3, true) + text(x + 42, y + 12, "MEI", 10, C.white, 800);
  for (let i = 0; i < 28; i++) {
    const cx = x + 8 + (i % 7) * 11.5;
    const cy = y + 26 + Math.floor(i / 7) * 13;
    out += circle(cx, cy, 1.6, C.grey);
    if (i === mark) out += circle(cx, cy, 6, "none", true).replace(INK, C.red);
  }
  return out;
}

function departures(x: number, y: number, rows: [string, string, string][]) {
  let out = rect(x, y, 230, 30 + rows.length * 22, C.navy, 5, true);
  out += text(x + 12, y + 20, "Vertrek", 13, C.white, 800, "start") + text(x + 218, y + 20, "Spoor", 11, C.grey, 700, "end");
  rows.forEach(([t, to, p], i) => {
    const ry = y + 44 + i * 22;
    out += text(x + 12, ry, t, 14, C.yellow, 800, "start") + text(x + 62, ry, to, 14, C.white, 700, "start") + text(x + 210, ry, p, 14, C.yellow, 800, "end");
  });
  return out;
}

function train(x: number, base: number) {
  let out = path(`M${x} ${base - 18}V${base - 100}Q${x} ${base - 112} ${x + 14} ${base - 112}H${W + 10}V${base - 18}Z`, C.yellow, true);
  out += rect(x, base - 40, W - x + 10, 14, C.sky2);
  for (let wx = x + 24; wx < W; wx += 54) out += rect(wx, base - 96, 40, 34, C.sky, 4, true);
  out += circle(x + 30, base - 12, 9, C.black, true) + circle(x + 80, base - 12, 9, C.black, true);
  return out;
}

function awning(x: number, y: number, w: number, colors = [C.orange, C.white]) {
  const n = 8;
  const sw = w / n;
  let out = "";
  for (let i = 0; i < n; i++)
    out += path(`M${x + i * sw} ${y}H${x + (i + 1) * sw}V${y + 26}Q${x + (i + 0.5) * sw} ${y + 38} ${x + i * sw} ${y + 26}Z`, colors[i % 2], true);
  return out;
}

const balloon = (x: number, y: number, color: string) =>
  stroke(`M${x} ${y + 22}q-6 20 2 46`, INK, 1.5) + ellipse(x, y, 17, 21, color, true) + path(`M${x - 4} ${y + 24}h8l-4-5z`, color, true);

function garland(x1: number, x2: number, y: number) {
  let out = stroke(`M${x1} ${y}Q${(x1 + x2) / 2} ${y + 28} ${x2} ${y}`, INK, 1.6);
  const colors = [C.red, C.white, C.sky2, C.orange];
  for (let i = 1; i < 10; i++) {
    const t = i / 10;
    const fx = x1 + (x2 - x1) * t;
    const fy = y + 28 * t * (1 - t) * 2;
    out += path(`M${fx - 8} ${fy}H${fx + 8}L${fx} ${fy + 16}Z`, colors[i % 4], true);
  }
  return out;
}

function cake(x: number, y: number, plateW = 40) {
  let out = rect(x - 30, y - 30, 60, 30, C.white, 4, true) + path(`M${x - 30} ${y - 18}q10 8 20 0t20 0t20 0`, "none", false, { stroke: C.rose, "stroke-width": 4 });
  for (const cx of [x - 14, x, x + 14]) out += rect(cx - 2.5, y - 46, 5, 16, C.sky2, 1, true) + ellipse(cx, y - 51, 3.5, 5.5, C.yellow, true);
  return out + ellipse(x, y + 2, plateW, 6, C.grey, true);
}

/** A black-and-white Dutch cow seen from the side, looking to the right; `base` is where the hooves stand. */
function cow(x: number, base: number, s = 1, flip = false) {
  const leg = (lx: number) => rect(lx, -40, 9, 38, C.white, 3, true) + rect(lx, -8, 9, 8, INK, 2);
  return g(
    // far legs first, a little darker
    rect(-30, -40, 9, 36, "#e6e6e6", 3, true) +
      rect(30, -40, 9, 36, "#e6e6e6", 3, true) +
      stroke("M-48-70Q-58-56-54-30", INK, 2) +
      path("M-58-34Q-54-24-50-34Q-53-38-58-34Z", INK) +
      leg(-42) +
      leg(18) +
      path("M-46-74Q-48-84-36-84H30Q42-84 44-72V-48Q44-36 32-36H-36Q-48-36-48-48Z", C.white, true) +
      // patches (inside the body outline)
      path("M-30-84H-4Q-2-70-12-62Q-26-58-30-70Z", INK) +
      path("M8-60Q20-66 30-56Q32-44 18-40Q4-42 8-60Z", INK) +
      path("M-46-56Q-36-54-36-44Q-38-38-46-40Z", INK) +
      ellipse(-30, -34, 9, 5, "#f3b4b4", true) +
      // head
      path("M36-80Q48-92 60-84L70-60Q72-50 62-48H54Q46-50 44-58Z", C.white, true) +
      path("M40-80Q50-90 58-84L60-74Q50-74 44-70Z", INK) +
      ellipse(64, -52, 9, 7, "#f3b4b4", true) +
      circle(61, -53, 1.4, INK) +
      circle(67, -53, 1.4, INK) +
      circle(55, -70, 2, C.white).replace("/>", "/>") +
      circle(55, -70, 1.6, INK) +
      path("M40-82Q30-88 28-80Q34-76 42-78Z", C.white, true) +
      path("M48-88Q50-96 54-94Q52-90 52-86Z", C.paperDoc, true),
    `translate(${x} ${base}) scale(${flip ? -s : s} ${s})`,
  );
}

function card(x: number, y: number, lines: string[], color = C.white, a = 0) {
  const w = 78;
  const h = 16 + lines.length * 14;
  let out = rect(-w / 2, 0, w, h, color, 2, true) + circle(0, 4, 3.5, C.red, true);
  lines.forEach((l, i) => (out += text(0, 20 + i * 14, l, i === 0 ? 11 : 10, INK, i === 0 ? 800 : 600)));
  return g(out, `translate(${x} ${y}) rotate(${a})`);
}

function booth(x: number, base: number) {
  return rect(x, base - 150, 90, 150, C.wallLilac, 2, true) + rect(x - 6, base - 160, 102, 14, C.navy, 3, true) + path(`M${x + 6} ${base - 146}Q${x + 20} ${base - 70} ${x + 8} ${base - 10}H${x + 40}Q${x + 30} ${base - 80} ${x + 40} ${base - 146}Z`, C.rose, true);
}

const stickyNote = (x: number, y: number, label: string, color: string, a = 0) =>
  g(rect(-34, -20, 68, 40, color, 2, true) + text(0, 5, label, 12, INK, 700), `translate(${x} ${y}) rotate(${a})`);

const suitcase = (x: number, base: number, color = C.rose) =>
  rect(x, base - 52, 36, 52, color, 5, true) + stroke(`M${x + 10} ${base - 52}V${base - 62}H${x + 26}V${base - 52}`, INK, 2.5) + circle(x + 8, base + 2, 3, INK) + circle(x + 28, base + 2, 3, INK);

const passport = (x: number, y: number) => rect(x - 9, y - 12, 18, 24, C.red, 2, true) + circle(x, y - 2, 4, "none", true).replace(INK, C.yellow);

const keys = (x: number, y: number) => circle(x, y, 5, "none", true) + path(`M${x + 3} ${y + 4}l8 9l-3 3l-2-2l-2 2l-2-2z`, C.yellow, true);

const gift = (x: number, y: number) => box(x - 18, y + 16, 36, 30) + stroke(`M${x} ${y - 14}V${y + 16}`, C.red, 4) + path(`M${x} ${y - 14}c-10-10-16 0-8 2zM${x} ${y - 14}c10-10 16 0 8 2z`, C.red, true);

/** A sofa; `seat` is the top of the cushion. Whoever sits on it is drawn after it (their legs hang over the front). */
const sofa = (x: number, seat: number, w: number, color = C.teal) =>
  rect(x, seat - 72, w, 80, color, 14, true) +
  rect(x + 8, seat - 4, w - 16, 30, color, 8, true) +
  rect(x - 12, seat - 40, 28, 70, color, 10, true) +
  rect(x + w - 16, seat - 40, 28, 70, color, 10, true) +
  rect(x + 4, seat + 30, 8, 12, C.woodDark) +
  rect(x + w - 12, seat + 30, 8, 12, C.woodDark);

// ---------- the scenes ----------

const kennismaken: Scene = {
  alt: "Twee mensen geven elkaar een hand en zeggen hallo.",
  draw: () => {
    const a: Peep = { x: 170, y: 306, h: TALL, pose: "standing/robot_dance-1", head: "Short 2", face: "Smile Big", colors: { skin: SKIN[3], top: C.orange, pants: C.navy } };
    const b0: Peep = { x: 310, y: 306, h: TALL, pose: "standing/robot_dance-3", head: "Bangs", flip: true, colors: { skin: SKIN[0], hair: "#e2b65a", top: C.sky2, pants: C.denim } };
    // stand just far enough apart for the hands to meet
    const b: Peep = { ...b0, x: b0.x + reach(a)[0] - reach(b0)[0] + 4 };
    return (
      room(C.wallBlue) +
      window(30, 60, 90, 110, "houses") +
      frame(380, 70, 64, 50, "tulips") +
      plant(440, FLOOR + 14, 1.1) +
      peep(a) +
      peep(b) +
      bubble(130, 56, "Hallo, ik ben Amir.", { tail: "right", size: 15 }) +
      bubble(350, 40, "Leuk je te ontmoeten!", { tail: "left", size: 15 })
    );
  },
};

const keuken: Scene = {
  alt: "Een man en een vrouw drinken koffie aan de keukentafel.",
  draw: () => {
    const top = 232;
    const a: Peep = { x: 150, y: top + 6, h: 330, pose: "body/Explaining", head: "Short 3", beard: "Full", colors: { skin: SKIN[1], top: C.grey } };
    const b: Peep = { x: 330, y: top + 6, h: 330, pose: "body/Coffee", head: "Long", flip: true, colors: { skin: SKIN[2], top: C.teal } };
    return (
      room(C.wall) +
      shelf(30, 100, 66, [C.rose, C.yellow, C.sky2, C.teal]) +
      window(190, 34, 100, 86, "trees") +
      clock(420, 58, 20, 8, 0) +
      rect(360, 124, 110, 6, C.woodDark) +
      pan(392, 124) +
      bottle(446, 124, C.green) +
      peep(a) +
      peep(b) +
      table(40, top, 400) +
      cup(200, top - 8, C.white) +
      plate(250, top - 8) +
      bubble(240, 104, "Wil je nog koffie?", { tail: "right", size: 15 })
    );
  },
};

const bellen: Scene = {
  alt: "Een vrouw zit op de bank, belt met haar telefoon en kijkt naar de kalender.",
  draw: () => {
    // In this pose the hips are 66 above the feet: the height of a seat.
    const p: Peep = { x: 196, y: 300, h: TALL, pose: "sitting/crossed_legs", head: "Hijab", face: "Explaining", colors: { skin: SKIN[2], scarf: C.rose, top: C.yellow, pants: C.navy } };
    return (
      room(C.wallLilac) +
      calendar(340, 70) +
      window(40, 44, 90, 100, "sky") +
      lamp(430, 30) +
      plant(440, FLOOR + 14) +
      sofa(110, 234, 220, C.teal) +
      peep(p) +
      phone(222, 199, -25) +
      bubble(230, 44, "Kun je morgen om drie uur?", { size: 15 })
    );
  },
};

const markt: Scene = {
  alt: "Een vrouw koopt fruit op de markt. De verkoper zegt de prijs.",
  draw: () => {
    const top = 220;
    const seller: Peep = { x: 330, y: top + 8, h: 330, pose: "body/Explaining", head: "No Hair 2", beard: "Moustache 3", glasses: "Glasses 2", flip: true, colors: { skin: SKIN[0], top: C.green } };
    const buyer: Peep = { x: 100, y: 312, h: TALL, pose: "standing/robot_dance-1", head: "Long Afro", colors: { skin: SKIN[4], top: C.violet, pants: C.denim } };
    return (
      outdoors(C.pavement) +
      gable(0, FLOOR, 70, 180, C.brick3, false, "step") +
      gable(400, FLOOR, 80, 170, C.brick, false, "bell") +
      cloud(130, 40) +
      rect(196, 60, 6, top - 60, C.woodDark) +
      rect(456, 60, 6, top - 60, C.woodDark) +
      awning(186, 46, 286) +
      peep(seller) +
      counter(200, top, 260, C.wood) +
      crate(212, top - 8, C.red) +
      crate(286, top - 8, C.orange) +
      crate(380, top - 8, C.green) +
      priceTag(244, top + 22, "€ 2,50") +
      priceTag(318, top + 22, "€ 1,99") +
      priceTag(412, top + 22, "€ 3,-") +
      peep(buyer) +
      bubble(112, 50, "Een kilo appels, graag.", { tail: "down", size: 14 }) +
      bubble(384, 100, "Dat is € 2,50.", { tail: "left", size: 14 })
    );
  },
};

const station: Scene = {
  alt: "Een man met een koffer kijkt op het bord met vertrektijden op het station.",
  draw: () => {
    const p: Peep = { x: 150, y: 308, h: TALL, pose: "standing/pointing_finger-1", head: "Twists", glasses: "Glasses 4", colors: { skin: SKIN[1], top: C.sky2, pants: C.navy } };
    return (
      rect(0, 0, W, H, C.wallBlue) +
      rect(0, 0, W, 18, C.grey) +
      train(300, 260) +
      rect(0, 260, W, H - 260, C.floorGrey) +
      rect(0, 256, W, 8, C.yellow) +
      departures(236, 30, [
        ["10:15", "Utrecht", "5"],
        ["10:32", "Amsterdam", "7"],
        ["10:47", "Den Haag", "3b"],
      ]) +
      stroke("M90 18V40", INK, 3) +
      clock(90, 58, 20, 10, 12) +
      sign(20, 110, 44, "5", C.navy, C.white, 20) +
      suitcase(76, 306) +
      peep(p)
    );
  },
};

const route: Scene = {
  alt: "Een vrouw vraagt de weg. Een man wijst naar links.",
  draw: () => {
    const a: Peep = { x: 310, y: 308, h: TALL, pose: "standing/pointing_finger-1", head: "Short 5", beard: "Goatee 1", face: "Explaining", flip: true, colors: { skin: SKIN[3], top: C.green, pants: C.denim } };
    const b: Peep = { x: 160, y: 308, h: TALL, pose: "standing/easing-2", head: "Medium Bangs 2", colors: { skin: SKIN[0], hair: "#b8642f", top: C.orange, jacket: C.sky, pants: C.navy } };
    return (
      rect(0, 0, W, H, C.sky) +
      cloud(400, 34) +
      gable(-10, 230, 90, 170, C.brick, true, "step") +
      gable(80, 230, 80, 190, C.brick3, true, "bell") +
      gable(160, 230, 90, 160, C.brick2, true, "point") +
      gable(250, 230, 84, 185, C.brick, true, "bell") +
      gable(334, 230, 90, 165, C.brick3, true, "step") +
      gable(424, 230, 80, 180, C.brick2, true, "bell") +
      rect(0, 230, W, H - 230, C.pavement) +
      stroke("M0 232H480", INK, 2) +
      sign(14, 140, 104, "Kerkstraat", C.white, C.navy, 13) +
      bike(430, 300, C.teal, 0.95) +
      peep(a) +
      peep(b) +
      bubble(136, 44, "Waar is het station?", { tail: "down", size: 15 }) +
      bubble(332, 44, "Hier links!", { tail: "down", size: 15 })
    );
  },
};

const huisarts: Scene = {
  alt: "Een patiënt vertelt de huisarts dat ze hoofdpijn heeft.",
  draw: () => {
    const top = 226;
    const doc: Peep = { x: 350, y: 330, h: TALL, pose: "standing/doctor-nurse-01", head: "Bun", flip: true, colors: { skin: SKIN[2], top: C.white, pants: C.sky2, jacket: C.white } };
    const pat: Peep = { x: 130, y: 308, h: TALL, pose: "standing/resting-2", head: "Medium Straight", face: "Concerned", colors: { skin: SKIN[0], top: C.rose, pants: C.denim } };
    return (
      room(C.wallGreen, C.floorGrey) +
      rect(240, 40, 54, 54, C.white, 6, true) +
      path("M259 50h16v12h12v16h-12v12h-16v-12h-12v-16h12z", C.red) +
      plant(452, FLOOR + 14) +
      peep(doc) +
      counter(256, top, 196, C.white, C.white) +
      laptop(410, top - 4, true) +
      letter(290, top - 10, 80, 22, 30) +
      peep(pat) +
      bubble(170, 56, "Ik heb hoofdpijn.", { tail: "left", size: 15 }) +
      bubble(390, 60, "Sinds wanneer?", { tail: "left", size: 14 })
    );
  },
};

const apotheek: Scene = {
  alt: "Een man haalt medicijnen bij de apotheek.",
  draw: () => {
    const top = 218;
    const ph: Peep = { x: 330, y: 330, h: TALL, pose: "standing/doctor-nurse-02", head: "Medium 2", flip: true, colors: { skin: SKIN[1], top: C.teal, jacket: C.white, pants: C.navy } };
    const cu: Peep = { x: 110, y: 310, h: TALL, pose: "standing/robot_dance-2", head: "Gray Short", beard: "Full 2", glasses: "Glasses", colors: { skin: SKIN[3], hair: "#c9ccd2", top: C.navy, pants: C.brown } };
    const [hx] = reach(cu);
    let shelves = "";
    for (const y of [74, 124, 174]) {
      shelves += rect(220, y, 240, 5, C.wood, 1, true);
      for (let i = 0; i < 9; i++) shelves += rect(228 + i * 26, y - 22, 20, 22, [C.white, C.sky, C.wallGreen, C.yellow][i % 4], 2, true);
    }
    return (
      room(C.wallGreen, C.floorGrey) +
      shelves +
      peep(ph) +
      counter(200, top, 280, C.white, C.green) +
      sign(270, top + 30, 130, "Apotheek", C.green, C.white, 16) +
      rect(Math.max(hx, 214), top - 28, 26, 20, C.white, 3, true) +
      stroke(`M${Math.max(hx, 214) + 6} ${top - 18}h14`, C.green, 3) +
      peep(cu) +
      bubble(140, 52, "Twee keer per dag?", { tail: "down", size: 14 })
    );
  },
};

const gemeente: Scene = {
  alt: "Een vrouw staat bij de balie van de gemeente met haar paspoort.",
  draw: () => {
    const top = 222;
    const clerk: Peep = { x: 330, y: top + 8, h: 330, pose: "body/Button Shirt 1", head: "Short 1", glasses: "Glasses 3", face: "Explaining", flip: true, colors: { skin: SKIN[0], top: C.white } };
    const cit: Peep = { x: 120, y: 310, h: TALL, pose: "standing/robot_dance-1", head: "Hijab", colors: { skin: SKIN[2], scarf: C.teal, top: C.orange, pants: C.navy } };
    const [hx, hy] = reach(cit);
    return (
      room(C.wallBlue, C.floorGrey) +
      sign(20, 20, 140, "GEMEENTE", C.navy, C.white, 16) +
      rect(396, 20, 70, 46, C.black, 5, true) +
      text(431, 42, "B 042", 17, "#ff6b4a", 800) +
      text(431, 58, "balie 3", 10, C.white, 600) +
      plant(40, FLOOR + 14, 1.1) +
      peep(clerk) +
      counter(220, top, 260, C.wallLilac, C.navy) +
      sign(240, top + 24, 70, "Balie 3", C.white, C.navy, 12) +
      laptop(410, top - 4, true) +
      peep(cit) +
      passport(hx + 4, hy - 6) +
      bubble(270, 72, "Uw paspoort, alstublieft.", { tail: "right", size: 14 })
    );
  },
};

const klas: Scene = {
  alt: "Een docent wijst naar het bord. Een cursist steekt haar vinger op.",
  draw: () => {
    const top = 246;
    const teacher: Peep = { x: 390, y: 300, h: TALL, pose: "standing/pointing_finger-1", head: "Gray Medium", glasses: "Glasses 5", face: "Explaining", flip: true, colors: { skin: SKIN[1], hair: "#c9ccd2", top: C.violet, pants: C.navy } };
    const s1: Peep = { x: 110, y: top + 8, h: 320, pose: "body/Pointing Up", head: "Short 4", colors: { skin: SKIN[4], hair: "#2b211c", top: C.orange } };
    const s2: Peep = { x: 240, y: top + 8, h: 320, pose: "body/Paper", head: "Bun 2", colors: { skin: SKIN[0], top: C.teal, accent: C.white } };
    return (
      room(C.wallGreen) +
      whiteboard(40, 30, 260, 120, ["de of het?", "de tafel · het huis", "de stoel · het boek"]) +
      clock(440, 50, 18, 9, 30) +
      peep(teacher) +
      peep(s1) +
      peep(s2) +
      table(40, top, 290) +
      openBook(110, top - 4) +
      book(250, top - 4, C.sky2)
    );
  },
};

const schoolplein: Scene = {
  alt: "Een vader brengt zijn dochter naar de basisschool.",
  draw: () => {
    const dad: Peep = { x: 150, y: 306, h: TALL, pose: "standing/pointing_finger-1", head: "Short 2", beard: "Full 3", colors: { skin: SKIN[3], top: C.sky2, pants: C.navy } };
    const kid: Peep = { x: 290, y: 300, h: 140, child: true, pose: "standing/walking-1", head: "Buns", face: "Smile Big", colors: { skin: SKIN[3], top: C.yellow, pants: C.rose } };
    return (
      outdoors(C.pavement) +
      rect(260, 70, 220, 180, C.brick, 0, true) +
      path("M250 74L370 30L490 74Z", C.navy, true) +
      sign(290, 90, 160, "Basisschool De Regenboog", C.white, C.navy, 11) +
      rect(290, 130, 40, 44, C.white, 3, true) +
      rect(410, 130, 40, 44, C.white, 3, true) +
      door(344, FLOOR, 52, 96, C.yellow) +
      tree(60, FLOOR + 6, 1.1) +
      sun(200, 46) +
      bike(440, 310, C.rose, 0.8) +
      peep(dad) +
      peep(kid) +
      bubble(110, 54, "Doei! Tot straks!", { tail: "right", size: 14 })
    );
  },
};

const kantoor: Scene = {
  alt: "Twee collega's praten op kantoor. Op het scherm staat een e-mail.",
  draw: () => {
    const top = 236;
    const sit: Peep = { x: 140, y: top + 8, h: 330, pose: "body/Macbook", head: "Long Curly", glasses: "Glasses 2", colors: { skin: SKIN[0], top: C.rose } };
    const stand: Peep = { x: 340, y: 306, h: TALL, pose: "standing/shirt-3", head: "No Hair 1", beard: "Full 4", face: "Explaining", flip: true, colors: { skin: SKIN[3], top: C.white, pants: C.navy } };
    return (
      room(C.wallBlue, C.floorGrey) +
      window(330, 34, 120, 100, "houses") +
      whiteboard(30, 36, 120, 76) +
      path("M46 100L70 84L92 92L132 56", "none", false, { stroke: C.orange, "stroke-width": 4, "stroke-linecap": "round", "stroke-linejoin": "round" }) +
      plant(450, FLOOR + 14) +
      peep(sit) +
      table(40, top, 260, C.white) +
      cup(270, top - 4, C.sky2) +
      peep(stand) +
      bubble(300, 60, "Heb je mijn mail gelezen?", { tail: "right", size: 14 })
    );
  },
};

const post: Scene = {
  alt: "Een man leest een brief aan de keukentafel.",
  draw: () => {
    const top = 236;
    const p: Peep = { x: 240, y: top + 8, h: 340, pose: "body/Paper", head: "Medium 1", face: "Awe", glasses: "Glasses 4", colors: { skin: SKIN[2], top: C.green, accent: C.white } };
    return (
      room(C.wall) +
      window(40, 40, 100, 100, "houses") +
      door(380, FLOOR, 64, 150, C.teal) +
      rect(392, 150, 40, 10, C.grey, 2, true) +
      peep(p) +
      table(60, top, 360) +
      envelope(130, top - 14, 40, 24) +
      envelope(340, top - 14, 40, 24, C.yellow) +
      cup(380, top - 18, C.orange) +
      bubble(330, 70, "Een brief van de gemeente…", { tail: "left", size: 13 })
    );
  },
};

const krant: Scene = {
  alt: "Een vrouw leest de krant op een bankje in het park.",
  draw: () => {
    // In this pose the hips are 66 above the feet: on the seat of the bench.
    const p: Peep = { x: 206, y: 300, h: TALL, pose: "sitting/crossed_legs", head: "Gray Bun", glasses: "Glasses", colors: { skin: SKIN[1], hair: "#e8e1e1", top: C.violet, jacket: C.violet, pants: C.denim } };
    return (
      outdoors() +
      cloud(90, 50) +
      cloud(380, 36, 0.8) +
      tree(60, FLOOR + 10, 1.25) +
      tree(420, FLOOR + 10, 1.1) +
      bush(340, FLOOR + 4) +
      tulips(100, FLOOR + 30) +
      rect(150, 182, 180, 10, C.wood, 3, true) +
      rect(150, 200, 180, 10, C.wood, 3, true) +
      rect(150, 234, 180, 10, C.wood, 3, true) +
      rect(162, 244, 8, 56, C.navy, 0, true) +
      rect(310, 244, 8, 56, C.navy, 0, true) +
      peep(p) +
      cup(312, 234, C.white) +
      // a folded newspaper in the hands that hold the knee
      g(
        rect(-22, -15, 44, 30, C.paperDoc, 2, true) + text(0, -4, "KRANT", 8, INK, 800) + stroke("M-16 3H16M-16 8H6", C.grey, 1.5) + stroke("M0-15V15", "#d9d4c7", 1),
        "translate(236 194) rotate(-18)",
      )
    );
  },
};

const verhuizen: Scene = {
  alt: "Een verhuurder geeft de sleutels van het nieuwe huis. Er staan dozen voor de deur.",
  draw: () => {
    const owner: Peep = { x: 340, y: 308, h: TALL, pose: "standing/robot_dance-2", head: "Gray Short", glasses: "Glasses 3", face: "Explaining", flip: true, colors: { skin: SKIN[0], hair: "#c9ccd2", top: C.navy, pants: C.grey } };
    const tenant: Peep = { x: 170, y: 308, h: TALL, pose: "standing/robot_dance-1", head: "Cornrows 2", face: "Smile Big", colors: { skin: SKIN[4], top: C.yellow, pants: C.denim } };
    const [kx, ky] = reach(owner);
    return (
      rect(0, 0, W, H, C.sky) +
      cloud(90, 40) +
      gable(270, 240, 210, 186, C.brick, true, "step", false) +
      rect(0, 240, W, H - 240, C.pavement) +
      stroke("M0 242H480", INK, 2) +
      box(10, 300, 66, 50, "KEUKEN") +
      box(18, 250, 50, 40) +
      box(14, 214, 58, 36, "BOEKEN") +
      plant(452, 304) +
      peep(owner) +
      peep(tenant) +
      keys(kx - 4, ky + 6) +
      bubble(330, 50, "Hier zijn de sleutels.", { tail: "down", size: 14 }) +
      bubble(140, 64, "Dank u wel!", { tail: "right", size: 14 })
    );
  },
};

const buren: Scene = {
  alt: "Twee buren praten voor hun huis. Naast de deur staan de containers voor afval.",
  draw: () => {
    const a: Peep = { x: 150, y: 308, h: TALL, pose: "standing/robot_dance-1", head: "Long Curly", face: "Explaining", colors: { skin: SKIN[1], top: C.rose, pants: C.navy } };
    const b: Peep = { x: 310, y: 308, h: TALL, pose: "standing/pointing_finger-1", head: "Flat Top", flip: true, colors: { skin: SKIN[3], top: C.teal, pants: C.denim } };
    const [cx, cy] = reach(a);
    const bin = (x: number, color: string, label: string) => rect(x, 196, 44, 58, color, 4, true) + rect(x - 3, 190, 50, 10, color, 3, true) + text(x + 22, 230, label, 9, C.white, 800);
    return (
      rect(0, 0, W, H, C.sky) +
      rect(0, 40, 240, 210, C.brick, 0, true) +
      rect(240, 40, 240, 210, C.brick3, 0, true) +
      path("M-10 44L120 0H360L490 44Z", C.navy, true) +
      window(30, 70, 80, 80) +
      door(150, 250, 56, 120, C.green) +
      window(370, 70, 80, 80) +
      door(270, 250, 56, 120, C.sky2) +
      rect(0, 250, W, H - 250, C.pavement) +
      stroke("M0 252H480", INK, 2) +
      bin(380, C.green, "GFT") +
      bin(430, C.navy, "REST") +
      peep(a) +
      peep(b) +
      cake(cx - 4, cy + 4, 34) +
      bubble(120, 54, "Goedemorgen, buurman!", { tail: "right", size: 14 })
    );
  },
};

const polder: Scene = {
  alt: "Een Nederlands landschap met een molen, water, koeien en tulpen.",
  draw: () => {
    let field = "";
    const stripes = [C.red, C.yellow, C.rose, C.orange, C.violet];
    for (let i = 0; i < 5; i++) field += path(`M${-40 + i * 110} 320L${150 + i * 50} 252H${196 + i * 50}L${70 + i * 110} 320Z`, stripes[i]);
    return (
      outdoors(C.grass) +
      sun(400, 56) +
      cloud(110, 46) +
      cloud(260, 70, 0.7) +
      path("M0 210Q120 196 240 206T480 204V250H0Z", C.grassDark) +
      windmill(110, 214, 1.15) +
      tree(430, 214, 0.6) +
      tree(460, 214, 0.5) +
      rect(0, 232, W, 22, C.water) +
      stroke("M30 242h40M150 246h50M300 240h40M400 246h40", C.white, 2) +
      field +
      cow(320, 232, 0.62) +
      cow(206, 228, 0.52, true)
    );
  },
};

const stemmen: Scene = {
  alt: "In het stembureau stopt een vrouw haar stembiljet in de stembus.",
  draw: () => {
    const top = 240;
    const v: Peep = { x: 240, y: 308, h: TALL, pose: "standing/robot_dance-1", head: "Medium Bangs 3", colors: { skin: SKIN[2], top: C.sky2, pants: C.navy } };
    const off: Peep = { x: 86, y: top + 8, h: 320, pose: "body/Paper", head: "No Hair 3", glasses: "Glasses", colors: { skin: SKIN[0], top: C.grey, accent: C.white } };
    const [hx, hy] = reach(v);
    return (
      room(C.wallLilac, C.floorGrey) +
      sign(150, 20, 180, "STEMBUREAU", C.orange, C.white, 18) +
      booth(380, FLOOR + 10) +
      peep(off) +
      table(20, top, 150, C.white) +
      rect(hx - 10, hy + 18, 70, 70, C.white, 6, true) +
      rect(hx + 12, hy + 16, 26, 6, INK, 2) +
      text(hx + 25, hy + 60, "STEMBUS", 10, C.navy, 800) +
      letter(hx + 24, hy + 4, 0, 18, 24) +
      peep(v)
    );
  },
};

const verjaardag: Scene = {
  alt: "Een verjaardag: taart met kaarsjes, ballonnen en een cadeau.",
  draw: () => {
    const a: Peep = { x: 120, y: 306, h: TALL, pose: "standing/robot_dance-1", head: "Short 4", face: "Smile Big", colors: { skin: SKIN[0], hair: "#e2b65a", top: C.sky2, pants: C.denim } };
    const b: Peep = { x: 370, y: 306, h: TALL, pose: "standing/pointing_finger-1", head: "Afro", face: "Smile LOL", flip: true, colors: { skin: SKIN[3], top: C.rose, pants: C.navy } };
    const [gx, gy] = reach(a);
    return (
      room(C.wall) +
      garland(20, 460, 20) +
      balloon(40, 110, C.red) +
      balloon(440, 120, C.sky2) +
      balloon(470, 96, C.yellow) +
      peep(a) +
      peep(b) +
      table(180, 236, 120, C.white) +
      cake(240, 226) +
      gift(gx + 8, gy - 4) +
      bubble(240, 90, "Gefeliciteerd!", { size: 18 })
    );
  },
};

const studeren: Scene = {
  alt: "Een vrouw leert Nederlandse woorden aan haar bureau met een laptop en een boek.",
  draw: () => {
    const top = 236;
    const p: Peep = { x: 230, y: top + 8, h: 340, pose: "body/Macbook", head: "Hijab", face: "Calm", colors: { skin: SKIN[3], scarf: C.navy, top: C.orange } };
    return (
      room(C.wallBlue) +
      stickyNote(350, 60, "de tafel", C.yellow, -4) +
      stickyNote(430, 66, "het huis", "#ffd1dc", 5) +
      stickyNote(370, 116, "de fiets", "#cdeccd", 3) +
      stickyNote(446, 126, "het boek", C.sky, -5) +
      shelf(40, 70, 70) +
      lamp(150, 110) +
      peep(p) +
      table(30, top, 420) +
      openBook(110, top - 4) +
      cup(420, top - 4, C.yellow)
    );
  },
};

const weekend: Scene = {
  alt: "Twee vrienden hebben een picknick in het park. Er staat een fiets.",
  draw: () => {
    const a: Peep = { x: 190, y: 296, h: TALL, pose: "sitting/hands_back-1", head: "Dreads 2", face: "Smile Big", colors: { skin: SKIN[2], top: C.yellow, pants: C.denim } };
    const b: Peep = { x: 310, y: 296, h: TALL, pose: "sitting/one_leg_up-1", head: "Long Bangs", flip: true, colors: { skin: SKIN[0], top: C.teal, pants: C.navy } };
    return (
      outdoors() +
      sun(420, 50) +
      cloud(120, 44) +
      tree(50, FLOOR + 10, 1.2) +
      tree(450, FLOOR + 6, 1) +
      bike(420, 296, C.orange, 0.9) +
      path("M90 304L150 254H350L410 304Z", C.red, true) +
      stroke("M130 270H370M110 287H390M200 254L170 304M260 254V304M320 254L350 304", C.white, 2) +
      peep(a) +
      peep(b) +
      path("M236 282h40l-4 18h-32z", C.wood, true) +
      stroke("M242 282q14 -18 28 0", INK, 2) +
      bubble(250, 60, "Wat een mooi weer!", { size: 15 })
    );
  },
};

const prikbord: Scene = {
  alt: "Een man leest de advertenties op het prikbord in de supermarkt.",
  draw: () => {
    const p: Peep = { x: 110, y: 308, h: TALL, pose: "standing/pointing_finger-1", head: "Pomp", glasses: "Glasses 2", colors: { skin: SKIN[1], top: C.red, pants: C.navy } };
    return (
      room(C.wallGreen, C.floorGrey) +
      rect(190, 30, 270, 190, C.wood, 6, true) +
      rect(200, 40, 250, 170, "#d7b48a", 3) +
      card(240, 50, ["TE KOOP", "Fiets, € 50", "06-1234567"], C.white, -3) +
      card(330, 46, ["GEZOCHT", "Oppas voor", "2 kinderen"], C.yellow, 2) +
      card(412, 56, ["TE HUUR", "Kamer", "€ 450 p/m"], "#ffd1dc", -2) +
      card(282, 130, ["CURSUS", "Nederlands", "ma 19:00"], C.sky, 3) +
      card(372, 128, ["GRATIS", "Kinderstoel"], "#cdeccd", -4) +
      path("M20 258h56l-6 48h-44z", C.orange, true) +
      stroke("M30 258q18 -22 36 0", INK, 2.5) +
      peep(p)
    );
  },
};

export const scenes: Record<string, Scene> = {
  kennismaken,
  keuken,
  bellen,
  markt,
  station,
  route,
  huisarts,
  apotheek,
  gemeente,
  klas,
  schoolplein,
  kantoor,
  post,
  krant,
  verhuizen,
  buren,
  polder,
  stemmen,
  verjaardag,
  studeren,
  weekend,
  prikbord,
  ...basisScenes,
  ...knmScenes,
  ...werkWonenScenes,
  ...lezenSchrijvenScenes,
  ...luisterenScenes,
};

