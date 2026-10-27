/**
 * Scenes for the Luisteren lessons: listening at the exam, on the phone, at the station, to the radio …
 * They hold no words or numbers, so a picture next to a listening fragment never hints at (or contradicts) an answer.
 */
import { C, FLOOR, H, INK, SKIN, W, circle, cloud, cup, ellipse, g, horn, laptop, path, phone, plant, radioSet, rect, room, stroke, sun, table, waves, window } from "./kit.js";
import { headBox, peep, type Peep } from "./peeps.js";
import type { Scene } from "./scenes.js";

const TALL = 236;

// ---------- props ----------

/** Over-ear headphones on a peep's head. */
function headphones(p: Peep, color = C.navy) {
  const b = headBox(p);
  const cx = b.x + b.w / 2;
  const ear = b.y + b.h * 0.6;
  const rx = b.w * 0.44;
  const band = `M${cx - rx} ${ear}C${cx - rx} ${b.y - b.h * 0.18} ${cx + rx} ${b.y - b.h * 0.18} ${cx + rx} ${ear}`;
  const cup = (x: number) => ellipse(x, ear, b.w * 0.1, b.h * 0.16, color, true) + ellipse(x, ear, b.w * 0.05, b.h * 0.09, "#ffffff33");
  return stroke(band, INK, 7) + stroke(band, color, 4) + cup(cx - rx) + cup(cx + rx);
}

/** A phone at a peep's ear, with sound coming out. */
function phoneAtEar(p: Peep, s = 1.6) {
  const b = headBox(p);
  const left = p.flip;
  const x = left ? b.x + b.w * 0.12 : b.x + b.w * 0.88;
  const y = b.y + b.h * 0.66;
  return g(phone(0, 0, left ? 18 : -18), `translate(${x} ${y}) scale(${s})`) + waves(x + (left ? -14 : 14) * s, y - 8 * s, left ? -1 : 1, 0.6 * s);
}

/** A blank wall calendar: squares only, no month or date. */
function wallCalendar(x: number, y: number) {
  let out = rect(x, y, 70, 64, C.white, 3, true) + rect(x, y, 70, 14, C.sky2, 3, true);
  for (let i = 0; i < 20; i++) out += rect(x + 7 + (i % 5) * 12, y + 22 + Math.floor(i / 5) * 10, 8, 6, i === 12 ? C.orange : "#e6e9ee", 1);
  return out;
}

/** An open agenda with lines, and a pen. */
function agenda(x: number, y: number) {
  return (
    path(`M${x - 46} ${y}L${x - 42} ${y - 10}H${x - 2}L${x} ${y - 6}L${x + 2} ${y - 10}H${x + 42}L${x + 46} ${y}Z`, C.white, true) +
    stroke(`M${x - 36} ${y - 6}H${x - 10}M${x + 10} ${y - 6}H${x + 36}`, C.grey, 1.5) +
    stroke(`M${x + 50} ${y - 2}l24-8`, C.navy, 3.5)
  );
}

/** Hi-vis colours for work clothes. */
const HIVIS = "#d8e84a";

function rack(x: number, w: number, top: number) {
  const levels = [FLOOR - 4, FLOOR - 64, FLOOR - 124, top];
  let out = rect(x, top - 6, 8, FLOOR - top + 6, C.orange, 1, true) + rect(x + w - 8, top - 6, 8, FLOOR - top + 6, C.orange, 1, true);
  levels.forEach((ly, i) => {
    out += rect(x, ly - 6, w, 6, C.sky2, 1, true);
    if (i === 0) return;
    // boxes on the shelf below this beam
    for (let bx = x + 14, k = 0; bx < x + w - 44; bx += 44, k++) {
      const bh = 30 + ((k + i) % 3) * 8;
      out += rect(bx, ly - 6 + 60 - bh - 6, 38, bh, k % 2 ? "#d9a86c" : "#c9935a", 2, true) + stroke(`M${bx + 4} ${ly + 48 - bh}H${bx + 34}`, "#a8743f", 2);
    }
  });
  return out;
}

const pallet = (x: number, base: number) =>
  rect(x, base - 10, 110, 10, C.woodDark, 1, true) +
  rect(x + 6, base - 56, 46, 46, "#d9a86c", 2, true) +
  rect(x + 58, base - 56, 46, 46, "#c9935a", 2, true) +
  rect(x + 30, base - 98, 46, 42, "#d9a86c", 2, true) +
  stroke(`M${x + 6} ${base - 40}H${x + 52}M${x + 58} ${base - 40}H${x + 104}M${x + 30} ${base - 82}H${x + 76}`, "#a8743f", 2);

function bunting(y: number) {
  const colors = [C.orange, C.yellow, C.teal, C.rose, C.sky2, C.green];
  let out = stroke(`M0 ${y}Q${W / 2} ${y + 24} ${W} ${y}`, INK, 1.5);
  for (let i = 0; i < 12; i++) {
    const x = 20 + i * 38;
    const t = x / W;
    const yy = y + 4 * 24 * t * (1 - t);
    out += path(`M${x - 12} ${yy}H${x + 12}L${x} ${yy + 22}Z`, colors[i % colors.length], true);
  }
  return out;
}

/** A flip chart with drawings, no words: a pan, a laptop and a conversation. */
function flipChart(x: number, top: number) {
  return (
    stroke(`M${x + 10} ${top + 120}L${x - 6} ${FLOOR}M${x + 90} ${top + 120}L${x + 106} ${FLOOR}M${x + 50} ${top + 120}V${FLOOR}`, INK, 3) +
    rect(x, top, 100, 124, C.white, 3, true) +
    rect(x - 4, top - 6, 108, 10, C.grey, 3, true) +
    // a pan
    path(`M${x + 14} ${top + 22}H${x + 42}V${top + 30}Q${x + 42} ${top + 36} ${x + 36} ${top + 36}H${x + 20}Q${x + 14} ${top + 36} ${x + 14} ${top + 30}Z`, C.navy, true) +
    stroke(`M${x + 42} ${top + 25}H${x + 54}`, INK, 3) +
    // a laptop
    g(laptop(0, 0), `translate(${x + 72} ${top + 40}) scale(0.7)`) +
    // two speech bubbles with dots
    path(`M${x + 14} ${top + 62}h34v20h-24l-6 6v-6h-4z`, C.yellow, true) +
    path(`M${x + 54} ${top + 84}h32v20h-4v6l-6-6h-22z`, C.sky, true) +
    [0, 1, 2].map((i) => circle(x + 24 + i * 7, top + 72, 1.8, INK) + circle(x + 63 + i * 7, top + 94, 1.8, INK)).join("")
  );
}

function chair(x: number, base: number, color = C.teal) {
  return rect(x - 22, base - 48, 44, 8, color, 3, true) + stroke(`M${x - 18} ${base - 40}V${base}M${x + 18} ${base - 40}V${base}`, INK, 3);
}

function bus(x: number, base: number) {
  let out = path(`M${x} ${base - 14}V${base - 112}Q${x} ${base - 124} ${x + 14} ${base - 124}H${W + 10}V${base - 14}Z`, C.white, true);
  out += rect(x, base - 52, W - x + 10, 10, C.red);
  out += rect(x + 8, base - 116, 52, 16, INK, 3) + [0, 1, 2, 3, 4].map((i) => circle(x + 16 + i * 9, base - 108, 2, C.yellow)).join("");
  for (let wx = x + 14; wx < W; wx += 50) out += rect(wx, base - 96, 38, 36, C.sky, 4, true);
  out += circle(x + 34, base - 10, 11, C.black, true) + circle(x + 34, base - 10, 4, C.grey);
  return out;
}

function shelter(x: number, w: number) {
  return (
    rect(x - 6, 92, w + 12, 12, C.navy, 3, true) +
    rect(x, 104, w, FLOOR - 104, "#cfe6f3aa") +
    stroke(`M${x} 104V${FLOOR}M${x + w} 104V${FLOOR}M${x + w / 2} 104V${FLOOR}`, C.navy, 4) +
    rect(x + 12, FLOOR - 40, w - 24, 8, C.woodDark, 2, true)
  );
}

/** The stop sign: a disc with a bus on it. */
function stopSign(x: number) {
  return (
    stroke(`M${x} 70V${FLOOR}`, C.grey, 6) +
    stroke(`M${x} 70V${FLOOR}`, INK, 1) +
    circle(x, 62, 24, C.yellow, true) +
    rect(x - 14, 50, 28, 20, C.navy, 4) +
    rect(x - 10, 54, 9, 7, C.white, 1) +
    rect(x + 1, 54, 9, 7, C.white, 1) +
    circle(x - 8, 72, 3, INK) +
    circle(x + 8, 72, 3, INK)
  );
}

function trainSide(x: number, base: number) {
  let out = path(`M${x} ${base - 18}V${base - 100}Q${x} ${base - 112} ${x + 14} ${base - 112}H${W + 10}V${base - 18}Z`, C.yellow, true);
  out += rect(x, base - 40, W - x + 10, 14, C.sky2);
  for (let wx = x + 24; wx < W; wx += 54) out += rect(wx, base - 96, 40, 34, C.sky, 4, true);
  out += circle(x + 30, base - 12, 9, C.black, true) + circle(x + 80, base - 12, 9, C.black, true);
  return out;
}

/** A call-out with a phone screen: a voicemail waiting, with a play button and the shape of the sound. */
function voicemailScreen(x: number, y: number) {
  const bars = [6, 14, 22, 10, 18, 26, 12, 20, 8, 16, 24, 10];
  return (
    rect(x, y, 120, 150, C.white, 14, true) +
    rect(x + 10, y + 12, 100, 126, "#eef4fa", 8) +
    // the voicemail sign: two circles and a line
    stroke(`M${x + 33} ${y + 44}a11 11 0 1 0 22 0a11 11 0 1 0 -22 0M${x + 65} ${y + 44}a11 11 0 1 0 22 0a11 11 0 1 0 -22 0`, INK, 4) +
    stroke(`M${x + 44} ${y + 55}H${x + 76}`, INK, 4) +
    circle(x + 100, y + 22, 7, C.red, true) +
    // play button and waveform
    circle(x + 30, y + 100, 14, C.orange, true) +
    path(`M${x + 25} ${y + 92}L${x + 37} ${y + 100}L${x + 25} ${y + 108}Z`, C.white) +
    bars.map((b, i) => rect(x + 50 + i * 5, y + 100 - b / 2, 3, b, C.sky2, 1.5)).join("")
  );
}

// ---------- scenes ----------

const luisterexamen: Scene = {
  alt: "Een examenzaal. Drie cursisten luisteren met een koptelefoon naar een fragment op de laptop.",
  draw: () => {
    const top = 240;
    const people: Peep[] = [
      { x: 90, y: top + 8, h: 300, pose: "body/Macbook", head: "Short 1", face: "Driven", colors: { skin: SKIN[2], top: C.rose } },
      { x: 240, y: top + 8, h: 300, pose: "body/Macbook", head: "Hijab", face: "Calm", colors: { skin: SKIN[1], scarf: C.violet, top: C.teal } },
      { x: 390, y: top + 8, h: 300, pose: "body/Macbook", head: "Short 3", face: "Driven", colors: { skin: SKIN[4], top: C.yellow } },
    ];
    return (
      room(C.wallGreen, C.floorGrey) +
      window(26, 30, 90, 90, "trees") +
      // a sign with headphones on it: this is the listening exam
      rect(204, 30, 72, 60, C.navy, 8, true) +
      stroke("M222 66C222 38 258 38 258 66", C.white, 5) +
      rect(216, 62, 12, 18, C.white, 4) +
      rect(252, 62, 12, 18, C.white, 4) +
      window(364, 30, 90, 90, "trees") +
      people.map((p) => peep(p) + headphones(p, C.navy)).join("") +
      table(20, top, 440, C.white) +
      waves(270, 118, 1, 0.8)
    );
  },
};

const telefoneren: Scene = {
  alt: "Een vrouw belt aan tafel. Ze heeft haar agenda open en een pen klaar.",
  draw: () => {
    const top = 240;
    const p: Peep = { x: 220, y: top + 8, h: 330, pose: "body/Explaining", head: "Long Bangs", face: "Explaining", colors: { skin: SKIN[0], hair: "#7a4a2c", top: C.sky2 } };
    return (
      room(C.wall) +
      window(40, 40, 100, 100, "houses") +
      wallCalendar(370, 50) +
      plant(440, FLOOR + 14) +
      peep(p) +
      phoneAtEar(p) +
      table(60, top, 360) +
      agenda(320, top - 2) +
      cup(110, top - 4, C.orange)
    );
  },
};

const voicemail: Scene = {
  alt: "Een man kijkt op zijn telefoon. Er is een voicemail voor hem.",
  draw: () => {
    const p: Peep = { x: 160, y: 340, h: 460, pose: "body/Device", head: "Short 5", beard: "Goatee 1", face: "Awe", colors: { skin: SKIN[3], top: C.green } };
    return (
      room(C.wallLilac) +
      window(24, 36, 90, 90, "sky") +
      plant(450, FLOOR + 14) +
      rect(40, 190, 250, 70, C.teal, 18, true) +
      peep(p) +
      // the call-out comes from the phone in his hands
      path("M222 248L300 160L322 182Z", C.white, true) +
      voicemailScreen(300, 26)
    );
  },
};

const perron: Scene = {
  alt: "Een perron. Uit een luidspreker komt een omroepbericht. Twee reizigers luisteren.",
  draw: () => {
    const a: Peep = { x: 150, y: 308, h: TALL, pose: "standing/resting-1", head: "Medium Bangs 2", face: "Concerned", colors: { skin: SKIN[1], hair: "#3a2a20", top: C.orange, pants: C.navy } };
    const b: Peep = { x: 250, y: 308, h: TALL, pose: "standing/crossed_arms-1", head: "Short 2", face: "Serious", glasses: "Glasses 4", colors: { skin: SKIN[3], top: C.teal, pants: C.denim } };
    return (
      rect(0, 0, W, H, C.wallBlue) +
      rect(0, 0, W, 22, C.navy) +
      stroke("M60 22V80M420 22V80", C.grey, 6) +
      horn(70, 86, 1, 1) +
      trainSide(320, 260) +
      rect(0, 260, W, H - 260, C.floorGrey) +
      rect(0, 256, W, 8, C.yellow) +
      g(rect(-14, -40, 28, 40, C.rose, 5, true) + stroke("M-6 -40V-48H6V-40", INK, 2.5) + circle(-8, 2, 3, INK) + circle(8, 2, 3, INK), "translate(96 304)") +
      peep(a) +
      peep(b)
    );
  },
};

const bushalte: Scene = {
  alt: "Bij een bushalte vraagt een vrouw iets aan een man. Er komt een bus aan.",
  draw: () => {
    const a: Peep = { x: 120, y: 304, h: TALL, pose: "standing/shirt-1", head: "Long Curly", face: "Calm", colors: { skin: SKIN[2], top: C.violet, pants: C.navy } };
    const b: Peep = { x: 228, y: 304, h: TALL, pose: "standing/pointing_finger-1", head: "Gray Short", face: "Explaining", flip: true, colors: { skin: SKIN[0], hair: "#c9ccd2", top: C.green, pants: C.grey } };
    return (
      rect(0, 0, W, FLOOR, C.sky) +
      cloud(70, 40) +
      cloud(260, 26, 0.8) +
      rect(0, FLOOR, W, 36, C.pavement) +
      rect(0, FLOOR + 36, W, H - FLOOR - 36, C.street) +
      shelter(30, 140) +
      stopSign(196) +
      bus(300, FLOOR + 6) +
      peep(a) +
      peep(b)
    );
  },
};

const magazijn: Scene = {
  alt: "In een magazijn legt een leidinggevende uit hoe het werkt. De nieuwe werknemer luistert.",
  draw: () => {
    const boss: Peep = { x: 300, y: 306, h: TALL, pose: "standing/blazer-1", head: "Bun", face: "Explaining", flip: true, colors: { skin: SKIN[1], hair: "#3a2a20", top: C.white, jacket: HIVIS, pants: C.navy } };
    const worker: Peep = { x: 190, y: 306, h: TALL, pose: "standing/crossed_arms-2", head: "Short 4", face: "Calm", colors: { skin: SKIN[3], top: C.sky2, pants: C.navy } };
    return (
      room("#e6e8ec", C.floorGrey) +
      rack(14, 150, 40) +
      rack(316, 150, 40) +
      pallet(350, FLOOR + 40) +
      peep(worker) +
      peep(boss)
    );
  },
};

const buurthuis: Scene = {
  alt: "In het buurthuis vertelt een man over de activiteiten. Twee buurtbewoners luisteren.",
  draw: () => {
    const host: Peep = { x: 330, y: 304, h: TALL, pose: "standing/shirt-2", head: "No Hair 2", beard: "Full 2", face: "Explaining", flip: true, colors: { skin: SKIN[2], top: C.orange, pants: C.navy } };
    const a: Peep = { x: 80, y: 300, h: TALL, pose: "sitting/mid-1", head: "Hijab", face: "Smile", colors: { skin: SKIN[3], scarf: C.teal, top: C.yellow, pants: C.navy } };
    const b: Peep = { x: 180, y: 300, h: TALL, pose: "sitting/closed_legs-1", head: "Medium 2", face: "Calm", colors: { skin: SKIN[0], hair: "#b8642f", top: C.rose, pants: C.denim } };
    return (
      room(C.wall) +
      bunting(10) +
      window(30, 60, 90, 80, "trees") +
      flipChart(370, 70) +
      chair(84, 286, C.teal) +
      chair(184, 286, C.teal) +
      peep(a) +
      peep(b) +
      peep(host)
    );
  },
};

const radio: Scene = {
  alt: "In de keuken luistert een vrouw naar de radio. Buiten schijnt de zon tussen de wolken.",
  draw: () => {
    const top = 240;
    const p: Peep = { x: 170, y: top + 8, h: 330, pose: "body/Coffee", head: "Medium Straight", face: "Calm", colors: { skin: SKIN[2], hair: "#3a2a20", top: C.teal } };
    const tiles = Array.from({ length: 6 }, (_, i) => rect(300 + i * 30, 120, 28, 28, i % 2 ? "#e9f2f6" : C.white)).join("");
    return (
      room(C.wallBlue) +
      rect(36, 30, 120, 100, C.sky, 4, true) +
      sun(70, 64, 16) +
      cloud(118, 74, 0.8) +
      stroke("M96 30V130M36 80H156", C.white, 5) +
      tiles +
      rect(290, 148, 190, 10, C.woodDark, 2, true) +
      radioSet(380, 148, 0.9) +
      waves(440, 110, 1, 0.9) +
      waves(322, 110, -1, 0.9) +
      peep(p) +
      table(40, top, 300) +
      plant(440, FLOOR + 14)
    );
  },
};

const oefenen: Scene = {
  alt: "'s Avonds oefent een man thuis met luisteren. Hij heeft een koptelefoon op en werkt op zijn laptop.",
  draw: () => {
    const top = 240;
    const p: Peep = { x: 220, y: top + 8, h: 330, pose: "body/Macbook", head: "Short 2", face: "Driven", glasses: "Glasses", colors: { skin: SKIN[1], top: C.navy } };
    const checks = [0, 1, 2].map((i) => stroke(`M352 ${top - 34 + i * 10}l3 3l6-7`, C.green, 2) + stroke(`M366 ${top - 33 + i * 10}H392`, C.grey, 1.5)).join("");
    return (
      room(C.wallLilac) +
      rect(40, 34, 110, 100, "#2c3a5e", 4, true) +
      circle(118, 62, 12, "#f4e7b5") +
      circle(124, 58, 10, "#2c3a5e") +
      [[60, 52], [80, 98], [132, 108], [70, 76]].map(([x, y]) => circle(x, y, 1.6, C.white)).join("") +
      stroke("M95 34V134M40 84H150", C.white, 5) +
      plant(440, FLOOR + 14) +
      stroke("M420 236V150l-30-20", INK, 3) +
      path("M372 118l30 12l-10 18l-30-12z", C.yellow, true) +
      peep(p) +
      headphones(p, C.orange) +
      table(60, top, 360) +
      rect(342, top - 44, 58, 42, C.white, 2, true) +
      checks +
      cup(110, top - 4, C.sky2) +
      waves(286, 92, 1, 0.8)
    );
  },
};

export const luisterenScenes: Record<string, Scene> = { luisterexamen, telefoneren, voicemail, perron, bushalte, magazijn, buurthuis, radio, oefenen };
