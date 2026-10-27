/** Scenes for the KNM lessons (knowledge of Dutch society). */
import {
  C, FLOOR, INK, SKIN, W, bike, bubble, circle, clock, cloud, counter, cup, door, ellipse, envelope, frame, g, gable, laptop, letter, outdoors, path,
  plant, rect, room, shelf, sign, stroke, sun, table, text, tree, whiteboard, window,
} from "./kit.js";
import { peep, reach, type Peep } from "./peeps.js";
import type { Scene } from "./scenes.js";

const TALL = 236;

// ---------- props ----------

function canal(y: number) {
  let ripples = "";
  for (let i = 0; i < 7; i++) ripples += stroke(`M${20 + i * 70} ${y + 18 + (i % 2) * 14}h${30 + (i % 3) * 8}`, C.white, 2);
  return rect(0, y, W, 320 - y, C.water) + rect(0, y - 6, W, 8, C.grey, 0, true) + ripples;
}

function boat(x: number, y: number, w: number, color = C.navy) {
  return path(`M${x} ${y}H${x + w}Q${x + w - 6} ${y + 26} ${x + w - 30} ${y + 28}H${x + 24}Q${x + 4} ${y + 24} ${x} ${y}Z`, color, true) + rect(x + 6, y - 4, w - 12, 8, C.wood, 3, true) + circle(x + w - 26, y + 12, 5, C.orange, true);
}

function bridge(x: number, y: number, w: number) {
  return path(`M${x} ${y}H${x + w}V${y + 46}H${x + w - 20}Q${x + w / 2} ${y + 2} ${x + 20} ${y + 46}H${x}Z`, C.brick2, true) + rect(x - 4, y - 12, w + 8, 14, C.brick, 2, true) + stroke(`M${x + 10} ${y - 12}V${y - 30}H${x + w - 10}V${y - 12}`, INK, 2.5);
}

const plaque = (x: number, y: number, lines: string[]) =>
  rect(x, y, 86, 14 + lines.length * 13, C.white, 2, true) + lines.map((l, i) => text(x + 43, y + 15 + i * 13, l, i === 0 ? 11 : 9, INK, i === 0 ? 800 : 600)).join("");

const stanchion = (x: number, base: number) => rect(x - 3, base - 46, 6, 46, "#c9a227", 2, true) + ellipse(x, base, 10, 3, "#c9a227", true) + circle(x, base - 48, 5, "#c9a227", true);

/** The Dutch flag on a pole; `rainbow` gives the rainbow flag instead. */
function flag(x: number, base: number, h: number, rainbow = false) {
  const colors = rainbow ? ["#e53935", "#fb8c00", "#fdd835", "#43a047", "#1e88e5", "#8e24aa"] : ["#ae1c28", "#ffffff", "#21468b"];
  const fh = 48;
  const band = fh / colors.length;
  const bands = colors.map((c, i) => rect(x + 3, base - h + i * band, 70, band + 0.5, c)).join("");
  return stroke(`M${x} ${base}V${base - h - 6}`, INK, 3) + circle(x, base - h - 8, 3.5, C.yellow, true) + bands + rect(x + 3, base - h, 70, fh, "none", 0, true);
}

function ambulance(x: number, base: number) {
  let checks = "";
  for (let i = 0; i < 12; i++) checks += rect(x + 6 + i * 14, base - 46 + (i % 2) * 8, 14, 8, i % 2 ? C.sky2 : C.yellow);
  return (
    path(`M${x} ${base - 16}V${base - 100}Q${x} ${base - 108} ${x + 8} ${base - 108}H${x + 150}L${x + 186} ${base - 66}V${base - 16}Z`, "#f5d33f", true) +
    checks +
    rect(x + 6, base - 46, 168, 16, "none", 0, true) +
    path(`M${x + 154} ${base - 100}L${x + 178} ${base - 70}H${x + 154}Z`, C.sky, true) +
    rect(x + 20, base - 96, 60, 34, C.sky, 3, true) +
    text(x + 104, base - 54, "AMBULANCE", 10, C.navy, 800) +
    rect(x + 70, base - 118, 30, 10, C.sky2, 3, true) +
    circle(x + 40, base - 14, 14, C.black, true) +
    circle(x + 40, base - 14, 5, C.grey) +
    circle(x + 150, base - 14, 14, C.black, true) +
    circle(x + 150, base - 14, 5, C.grey)
  );
}

function flowers(x: number, y: number) {
  return path(`M${x - 6} ${y}L${x - 14} ${y - 30}H${x + 14}L${x + 6} ${y}Z`, C.white, true) + [[-10, -40, C.red], [2, -46, C.yellow], [12, -38, C.rose], [-2, -34, C.orange]].map(([dx, dy, c]) => circle(x + (dx as number), y + (dy as number), 7, c as string, true)).join("");
}

const watchClock = (x: number, y: number) => clock(x, y, 18, 3, 0);

function benches(x: number, y: number, w: number, color: string) {
  return rect(x, y, w, 30, color, 6, true) + stroke(`M${x + 8} ${y + 10}H${x + w - 8}`, "#00000022", 3);
}

function lectern(x: number, base: number) {
  return path(`M${x - 34} ${base - 92}H${x + 34}L${x + 26} ${base}H${x - 26}Z`, C.wood, true) + rect(x - 40, base - 98, 80, 10, C.woodDark, 3, true) + stroke(`M${x - 6} ${base - 98}l-6-18`, INK, 2) + circle(x - 13, base - 118, 4, INK);
}

/** The scales of justice, as an emblem on a wall. */
function scales(x: number, y: number) {
  const pan = (px: number) => stroke(`M${px} ${y + 6}L${px - 14} ${y + 34}M${px} ${y + 6}L${px + 14} ${y + 34}`, "#a88a2a", 1.5) + path(`M${px - 18} ${y + 34}Q${px} ${y + 48} ${px + 18} ${y + 34}Z`, "#e0bd4f", true);
  return circle(x, y + 34, 48, "#f3e7c2", true) + stroke(`M${x} ${y - 4}V${y + 62}M${x - 30} ${y + 6}H${x + 30}M${x - 14} ${y + 64}H${x + 14}`, "#a88a2a", 3.5) + pan(x - 30) + pan(x + 30);
}

function card(x: number, y: number, label: string, color: string) {
  return rect(x, y, 54, 34, color, 4, true) + rect(x + 6, y + 6, 14, 10, C.yellow, 2) + text(x + 27, y + 28, label, 8, C.white, 800);
}

function rapport(x: number, y: number) {
  let lines = "";
  for (let i = 0; i < 4; i++) lines += stroke(`M${x - 22} ${y - 30 + i * 9}H${x + 6}`, C.grey, 1.6) + text(x + 16, y - 27 + i * 9, ["8", "7", "9", "7"][i], 8, C.green, 800);
  return path(`M${x - 30} ${y}L${x - 26} ${y - 46}H${x + 30}L${x + 26} ${y}Z`, C.white, true) + text(x, y - 36, "RAPPORT", 8, C.navy, 800) + lines;
}

const drawing = (x: number, y: number, color: string, a: number) =>
  g(rect(-20, -16, 40, 32, C.white, 1, true) + circle(-6, -2, 6, C.yellow) + path("M-14 12L-2 2L6 8L14 0V12Z", color), `translate(${x} ${y}) rotate(${a})`);

function bikeRack(x: number, base: number, n: number) {
  let out = stroke(`M${x} ${base - 10}H${x + n * 40}`, C.grey, 4);
  for (let i = 0; i < n; i++) out += bike(x + 20 + i * 40, base, [C.teal, C.red, C.navy, C.yellow][i % 4], 0.62);
  return out;
}

// ---------- scenes ----------

const grachten: Scene = {
  alt: "Amsterdam: grachtenpanden uit de Gouden Eeuw, een brug en een bootje op de gracht.",
  draw: () => {
    const a: Peep = { x: 266, y: 262, h: 290, pose: "body/Explaining", head: "Short 2", colors: { skin: SKIN[1], top: C.sky2 } };
    const b: Peep = { x: 336, y: 262, h: 280, pose: "body/Tee 1", head: "Medium Bangs 3", flip: true, colors: { skin: SKIN[3], top: C.yellow } };
    const houses: [number, number, string, "step" | "bell" | "point"][] = [
      [0, 170, C.brick, "step"],
      [70, 190, C.brick3, "bell"],
      [134, 160, C.brick2, "point"],
      [204, 196, "#7c8b5a", "bell"],
      [268, 176, C.brick, "step"],
      [338, 190, C.brick3, "bell"],
      [404, 168, C.brick2, "point"],
    ];
    return (
      rect(0, 0, W, 320, C.sky) +
      cloud(400, 30) +
      houses.map(([x, h, c, st]) => gable(x, 210, x === 0 ? 70 : 66, h, c, true, st)).join("") +
      tree(40, 214, 0.6) +
      tree(440, 214, 0.6) +
      canal(214) +
      bridge(20, 226, 140) +
      bike(60, 214, C.red, 0.55) +
      bike(110, 214, C.teal, 0.55) +
      peep(a) +
      peep(b) +
      boat(210, 254, 200)
    );
  },
};

const museum: Scene = {
  alt: "In een museum over de twintigste eeuw. Een gids vertelt over de Tweede Wereldoorlog.",
  draw: () => {
    const guide: Peep = { x: 368, y: 306, h: TALL, pose: "standing/pointing_finger-1", head: "Gray Short", glasses: "Glasses", face: "Explaining", flip: true, colors: { skin: SKIN[0], hair: "#c9ccd2", top: C.navy, pants: C.grey } };
    const v: Peep = { x: 448, y: 306, h: 228, pose: "standing/resting-1", head: "Long Afro", flip: true, colors: { skin: SKIN[4], top: C.teal, pants: C.denim } };
    return (
      room("#efe7dc", C.floorGrey) +
      text(240, 30, "Nederland in de 20e eeuw", 15, INK, 800) +
      frame(20, 56, 84, 66) +
      frame(126, 50, 66, 84, "tulips") +
      rect(214, 56, 80, 64, "#4b4b4b", 2, true) +
      rect(222, 64, 64, 48, "#8a8a8a") +
      path("M226 108L246 84L260 98L270 90L282 108Z", "#5e5e5e") +
      plaque(20, 136, ["1940 – 1945", "De oorlog"]) +
      plaque(212, 132, ["1919", "Vrouwen stemmen"]) +
      stanchion(20, 270) +
      stanchion(290, 270) +
      stroke("M20 222Q155 250 290 222", C.red, 4) +
      peep(v) +
      peep(guide)
    );
  },
};

const zorgverzekering: Scene = {
  alt: "Een vrouw vergelijkt zorgverzekeringen op haar laptop. Op tafel ligt haar zorgpas.",
  draw: () => {
    const top = 236;
    const p: Peep = { x: 230, y: top + 8, h: 340, pose: "body/Macbook", head: "Medium 2", glasses: "Glasses 4", face: "Concerned", colors: { skin: SKIN[1], top: C.teal } };
    return (
      room(C.wallBlue) +
      window(40, 40, 100, 100, "houses") +
      rect(350, 74, 116, 90, C.white, 4, true) +
      text(408, 96, "Zorgverzekering", 11, C.navy, 800) +
      text(408, 116, "Basis: € 140", 11, INK, 600) +
      text(408, 132, "Eigen risico:", 10, INK, 600) +
      text(408, 148, "€ 385", 11, C.red, 800) +
      peep(p) +
      table(40, top, 400) +
      card(90, top - 40, "ZORGPAS", C.sky2) +
      letter(370, top - 14, 80, 22, 30) +
      cup(420, top - 4, C.orange) +
      bubble(230, 60, "Welke verzekering kies ik?", { size: 14, think: [232, 104] })
    );
  },
};

const belasting: Scene = {
  alt: "Een man krijgt een blauwe brief van de Belastingdienst. Hij moet voor 1 mei aangifte doen.",
  draw: () => {
    const top = 236;
    const p: Peep = { x: 230, y: top + 8, h: 340, pose: "body/Paper", head: "Short 5", beard: "Full 2", face: "Concerned", colors: { skin: SKIN[2], top: C.green, accent: C.white } };
    return (
      room(C.wall) +
      window(40, 40, 100, 100, "trees") +
      rect(366, 70, 96, 86, C.white, 3, true) +
      rect(366, 70, 96, 20, C.red, 3, true) +
      text(414, 85, "APRIL", 11, C.white, 800) +
      text(414, 132, "30", 32, INK, 800) +
      peep(p) +
      table(40, top, 400) +
      // the blue envelope of the Belastingdienst
      envelope(122, top - 22, 76, 40, "#2f6db5") +
      rect(92, top - 22, 40, 12, C.white, 1, true) +
      laptop(370, top - 4) +
      bubble(240, 60, "Aangifte doen voor 1 mei!", { size: 14, think: [236, 104] })
    );
  },
};

const alarm: Scene = {
  alt: "Er is een ongeluk. Een vrouw roept om hulp. De ambulance komt. Het alarmnummer is 112.",
  draw: () => {
    const caller: Peep = { x: 110, y: 306, h: TALL, pose: "standing/pointing_finger-1", head: "Hijab", face: "Concerned", colors: { skin: SKIN[2], scarf: C.orange, top: C.navy, pants: C.navy } };
    return (
      rect(0, 0, W, 320, C.sky) +
      gable(0, 236, 90, 170, C.brick, false, "bell") +
      gable(90, 236, 80, 150, C.brick3, false, "point") +
      gable(390, 236, 90, 176, C.brick2, false, "step") +
      rect(0, 236, W, 84, C.street) +
      rect(0, 232, W, 8, C.pavement, 0, true) +
      stroke("M0 280H480", C.white, 3).replace('stroke-linecap="round"', 'stroke-dasharray="24 18"') +
      ambulance(240, 290) +
      peep(caller) +
      rect(170, 40, 80, 56, C.red, 10, true) +
      text(210, 82, "112", 30, C.white, 800) +
      bubble(118, 52, "Bel 112!", { tail: "down", size: 15 })
    );
  },
};

const afspraak: Scene = {
  alt: "Een gast komt precies om drie uur. Hij heeft bloemen meegenomen.",
  draw: () => {
    const host: Peep = { x: 330, y: 306, h: TALL, pose: "standing/robot_dance-2", head: "Bun 2", face: "Smile", flip: true, colors: { skin: SKIN[0], top: C.rose, pants: C.navy } };
    const guest: Peep = { x: 150, y: 306, h: TALL, pose: "standing/robot_dance-1", head: "Short 3", beard: "Goatee 2", colors: { skin: SKIN[3], top: C.white, pants: C.navy } };
    const [fx, fy] = reach(guest);
    return (
      rect(0, 0, W, 320, C.sky) +
      rect(240, 30, 240, 230, C.brick, 0, true) +
      door(300, 260, 70, 150, C.green) +
      rect(296, 106, 78, 8, C.white) +
      window(390, 60, 70, 80) +
      plant(268, 264, 0.8) +
      rect(0, 260, W, 60, C.pavement) +
      stroke("M0 262H480", INK, 2) +
      stroke("M44 262V96", INK, 4) +
      watchClock(44, 76) +
      peep(guest) +
      peep(host) +
      flowers(fx + 6, fy + 10) +
      bubble(370, 54, "U bent precies op tijd!", { tail: "left", size: 14 })
    );
  },
};

const diversiteit: Scene = {
  alt: "Verschillende mensen op een plein. In Nederland is iedereen gelijk.",
  draw: () => {
    const ppl: Peep[] = [
      { x: 60, y: 306, h: 226, pose: "standing/resting-2", head: "Gray Short", glasses: "Glasses 2", colors: { skin: SKIN[0], hair: "#c9ccd2", top: C.sky2, pants: C.grey } },
      { x: 150, y: 306, h: TALL, pose: "standing/blazer-1", head: "Hijab", colors: { skin: SKIN[2], scarf: C.rose, jacket: C.yellow, top: C.white, pants: C.navy } },
      { x: 250, y: 306, h: 236, pose: "sitting/wheelchair", head: "Dreads 1", face: "Cute", colors: { skin: SKIN[4], top: C.orange, pants: C.denim } },
      { x: 340, y: 306, h: TALL, pose: "standing/crossed_arms-1", head: "Turban", beard: "Full 3", colors: { skin: SKIN[3], scarf: C.orange, top: C.teal, pants: C.navy } },
      { x: 430, y: 306, h: 228, pose: "standing/easing-2", head: "Medium Bangs 2", flip: true, colors: { skin: SKIN[1], hair: "#e2b65a", top: C.violet, jacket: C.sky, pants: C.denim } },
    ];
    return (
      outdoors(C.pavement) +
      cloud(100, 30) +
      gable(150, FLOOR, 180, 190, C.brick, false, "step") +
      flag(90, 120, 100) +
      flag(320, 120, 100, true) +
      rect(172, 24, 136, 28, C.white, 4, true) +
      text(240, 43, "Iedereen is gelijk", 13, C.navy, 800) +
      ppl.map(peep).join("")
    );
  },
};

const mbo: Scene = {
  alt: "Twee jongeren gaan met de fiets naar het mbo.",
  draw: () => {
    const a: Peep = { x: 170, y: 306, h: 214, pose: "standing/walking-1", head: "Twists", colors: { skin: SKIN[3], top: C.green, pants: C.navy } };
    const b: Peep = { x: 260, y: 306, h: 208, pose: "standing/walking-2", head: "Bun", colors: { skin: SKIN[0], top: C.rose, pants: C.denim } };
    return (
      outdoors(C.pavement) +
      sun(60, 50) +
      rect(200, 50, 280, 200, C.wallBlue, 0, true) +
      rect(200, 50, 280, 30, C.navy, 0, true) +
      text(340, 72, "mbo college", 17, C.white, 800) +
      [230, 300, 370, 440].map((x) => rect(x - 22, 100, 44, 50, C.sky, 3, true)).join("") +
      door(330, FLOOR, 70, 80, "#cfe8f7") +
      bikeRack(20, 300, 3) +
      peep(a) +
      peep(b) +
      bubble(210, 46, "Ik doe een opleiding tot kok.", { tail: "down", size: 13 })
    );
  },
};

const oudergesprek: Scene = {
  alt: "Een moeder praat met de juf over het rapport van haar dochter.",
  draw: () => {
    const top = 238;
    const juf: Peep = { x: 330, y: top + 8, h: 330, pose: "body/Explaining", head: "Long Bangs", face: "Explaining", flip: true, colors: { skin: SKIN[0], top: C.orange } };
    const mom: Peep = { x: 140, y: top + 8, h: 330, pose: "body/Button Shirt 1", head: "Hijab", colors: { skin: SKIN[3], scarf: C.sky2, top: C.white } };
    return (
      room(C.wallGreen) +
      drawing(60, 60, C.red, -4) +
      drawing(116, 56, C.sky2, 3) +
      drawing(172, 62, C.green, -2) +
      whiteboard(300, 30, 150, 80, ["Groep 6"]) +
      text(330, 92, "a b c  1 2 3", 13, INK, 700, "start") +
      shelf(30, 140, 90) +
      peep(mom) +
      peep(juf) +
      table(60, top, 360) +
      rapport(240, top - 4) +
      bubble(330, 136, "Ze doet het goed!", { tail: "down", size: 14 })
    );
  },
};

const parlement: Scene = {
  alt: "De Tweede Kamer. Een Kamerlid spreekt. De Kamerleden luisteren.",
  draw: () => {
    const speaker: Peep = { x: 240, y: 214, h: 260, pose: "body/Pointing Up", head: "Short 1", face: "Explaining", colors: { skin: SKIN[3], top: C.navy } };
    const left = (x: number, head: string, skin: string, top: string) => peep({ x, y: 262, h: 280, pose: "body/Blazer Black Tee", head, colors: { skin, top, jacket: top } });
    const right = (x: number, head: string, skin: string, top: string) => peep({ x, y: 262, h: 280, pose: "body/Button Shirt 2", head, flip: true, colors: { skin, top } });
    return (
      rect(0, 0, W, 320, "#2f6f86") +
      rect(0, 0, W, 120, "#3b8aa3") +
      text(240, 30, "TWEEDE KAMER", 15, C.white, 800) +
      flag(380, 140, 110) +
      peep(speaker) +
      lectern(240, 300) +
      left(60, "Long", SKIN[0], C.sky2) +
      left(130, "No Hair 2", SKIN[2], C.grey) +
      benches(0, 256, 170, "#2a6b4f") +
      right(350, "Hijab", SKIN[3], C.rose) +
      right(420, "Short 4", SKIN[1], C.white) +
      benches(310, 256, 170, "#2a6b4f")
    );
  },
};

const rechtbank: Scene = {
  alt: "In de rechtbank. De rechter luistert naar de advocaat.",
  draw: () => {
    const judge: Peep = { x: 240, y: 178, h: 270, pose: "body/Blazer Black Tee", head: "Gray Medium", glasses: "Glasses", colors: { skin: SKIN[0], hair: "#d9d9d9", jacket: INK, top: INK } };
    const lawyer: Peep = { x: 110, y: 306, h: TALL, pose: "standing/pointing_finger-1", head: "Short 2", face: "Explaining", colors: { skin: SKIN[3], top: INK, pants: C.navy } };
    const def: Peep = { x: 390, y: 306, h: TALL, pose: "standing/crossed_arms-2", head: "Short 3", face: "Concerned", flip: true, colors: { skin: SKIN[1], top: C.grey, pants: C.denim } };
    return (
      room("#efe4d2", "#c8a27a") +
      g(scales(0, 0), "translate(240 8) scale(0.66)") +
      sign(20, 20, 140, "RECHTBANK", C.navy, C.white, 14) +
      peep(judge) +
      rect(140, 170, 200, 80, C.woodDark, 4, true) +
      rect(130, 162, 220, 14, C.wood, 3, true) +
      peep(lawyer) +
      peep(def)
    );
  },
};

export const knmScenes: Record<string, Scene> = { grachten, museum, zorgverzekering, belasting, alarm, afspraak, diversiteit, mbo, oudergesprek, parlement, rechtbank };

void [counter, FLOOR, tree];
