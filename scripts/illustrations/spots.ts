/**
 * Spot illustrations: one person, animal or object without a background, to stand next to an exercise
 * (like the little drawings in the margin of a language book). Canvas SW × SH, transparent.
 */
import { C, INK, SKIN, bike, box, circle, clock, ellipse, envelope, g, gable, laptop, openBook, path, phone, plant, rect, stroke, text, tulips, windmill } from "./kit.js";
import { peep, type Peep } from "./peeps.js";

export const SW = 200;
export const SH = 220;

export interface Spot {
  alt: string;
  draw: () => string;
}

/** A standing person filling the canvas. */
const stand = (p: Omit<Peep, "x" | "y" | "h">) => peep({ x: 100, y: 214, h: 204, ...p });
/** A person from the waist up, filling the canvas. */
const bust = (p: Omit<Peep, "x" | "y" | "h">) => peep({ x: 100, y: 222, h: 470, ...p });
/** Draw something made for a scene bigger, centred on the canvas. */
const big = (s: number, body: string, dx = 100, dy = 200) => g(body, `translate(${dx} ${dy}) scale(${s})`);

function cat(color = "#9aa0aa") {
  return (
    stroke("M40-20Q70-30 66-70", INK, 9) +
    stroke("M40-20Q70-30 66-70", color, 5) +
    path("M-40-6Q-44-60 0-62Q40-60 42-6Z", color, true) +
    ellipse(-22, -4, 12, 6, color, true) +
    ellipse(20, -4, 12, 6, color, true) +
    path("M-30-70L-34-104L-12-84Q0-88 12-84L34-104L30-70Q30-48 0-46Q-30-48-30-70Z", color, true) +
    circle(-12, -72, 3, INK) +
    circle(12, -72, 3, INK) +
    path("M-4-64h8l-4 4z", "#f3a0a0") +
    stroke("M-4-60q4 4 8 0M-30-64h-14M-30-60l-12 4M30-64h14M30-60l12 4", INK, 1.5)
  );
}

function duck() {
  return (
    ellipse(0, -30, 46, 26, "#f2efe6", true) +
    path("M-46-34Q-60-40-54-22Z", "#f2efe6", true) +
    path("M18-46Q16-86 40-86Q62-86 60-60Q58-46 44-42Z", "#2f7d4f", true) +
    path("M56-66L80-60Q82-54 76-52L56-56Z", C.orange, true) +
    circle(44, -70, 3, INK) +
    rect(20, -46, 26, 6, C.white) +
    stroke("M-20-14Q0 0 24-14", "#c9c2b0", 2) +
    rect(-8, -6, 4, 10, C.orange) +
    rect(10, -6, 4, 10, C.orange)
  );
}

function wallet() {
  return (
    rect(-60, -70, 120, 80, "#7a5236", 12, true) +
    rect(-60, -70, 120, 30, "#8f6342", 12, true) +
    circle(-20, -84, 18, C.yellow, true) +
    text(-20, -78, "€", 18, "#a07c10", 800) +
    rect(10, -96, 56, 30, "#7cc29a", 3, true) +
    text(38, -76, "€ 20", 12, "#2f6f4f", 800)
  );
}

function calendarBig() {
  let out = rect(-70, -130, 140, 130, C.white, 6, true) + rect(-70, -130, 140, 30, C.red, 6, true) + text(0, -109, "MAANDAG", 13, C.white, 800);
  out += text(0, -38, "12", 56, INK, 800) + text(0, -12, "september", 13, C.grey, 700);
  return out + rect(-46, -140, 8, 20, C.grey, 3, true) + rect(38, -140, 8, 20, C.grey, 3, true);
}

const pills = () =>
  rect(-30, -120, 60, 110, C.white, 6, true) + rect(-34, -134, 68, 18, C.red, 4, true) + rect(-24, -96, 48, 40, C.white, 2, true) + text(0, -80, "2x per", 10, INK, 700) + text(0, -66, "dag", 10, INK, 700) +
  g(rect(-20, -8, 40, 16, C.white, 8, true) + rect(0, -8, 20, 16, C.sky2, 8, true), "translate(50 -10) rotate(-30)");

const keysBig = () => path("M-4-44l50 50l-10 10l-8-8l-8 8l-8-8l-8 8l-20-20z", C.yellow, true) + circle(-20, -60, 22, C.yellow, true) + circle(-20, -60, 9, "#fff8ee", true);

const flowersBig = () =>
  path("M-14 0L-30-70H30L14 0Z", C.white, true) + [[-22, -90, C.red], [6, -102, C.yellow], [28, -84, C.rose], [-4, -78, C.orange], [16, -66, C.violet]].map(([x, y, c]) => circle(x as number, y as number, 16, c as string, true) + circle(x as number, y as number, 5, C.yellow)).join("");

const ballot = () => rect(-60, -100, 120, 100, C.white, 8, true) + rect(-24, -104, 48, 8, INK, 3) + text(0, -40, "STEMBUS", 14, C.navy, 800) + g(rect(-14, -20, 28, 40, C.white, 2, true) + stroke("M-8-8h16M-8 0h10", C.grey, 2) + stroke("M-6 10l4 4l8-10", C.red, 2.5), "translate(0 -120)");

const graduation = () =>
  path("M-80-80L0-110L80-80L0-50Z", INK, true) + path("M-44-66V-36Q0-16 44-36V-66L0-50Z", "#3a4054", true) + stroke("M80-80V-40", C.yellow, 3) + circle(80, -36, 6, C.yellow, true) + g(openBook(0, 0), "translate(0 0) scale(1.6)");

export const spots: Record<string, Spot> = {
  // people
  lezen: { alt: "Een man leest een papier.", draw: () => bust({ pose: "body/Paper", head: "Short 2", glasses: "Glasses", colors: { skin: SKIN[2], top: C.teal, accent: C.white } }) },
  laptop: { alt: "Een vrouw werkt op een laptop.", draw: () => bust({ pose: "body/Macbook", head: "Long Curly", colors: { skin: SKIN[0], top: C.rose } }) },
  koffie: { alt: "Een vrouw drinkt koffie.", draw: () => bust({ pose: "body/Coffee", head: "Hijab", colors: { skin: SKIN[3], scarf: C.orange, top: C.sky2 } }) },
  bellen: { alt: "Een man kijkt op zijn telefoon.", draw: () => bust({ pose: "body/Device", head: "Twists 2", colors: { skin: SKIN[4], top: C.yellow } }) },
  uitleggen: { alt: "Een vrouw legt iets uit.", draw: () => bust({ pose: "body/Explaining", head: "Bun 2", face: "Explaining", colors: { skin: SKIN[1], top: C.orange } }) },
  idee: { alt: "Een man heeft een idee.", draw: () => bust({ pose: "body/Pointing Up", head: "Short 4", face: "Smile", colors: { skin: SKIN[0], hair: "#e2b65a", top: C.navy } }) },
  denken: { alt: "Een vrouw denkt na.", draw: () => bust({ pose: "body/Tee Arms Crossed", head: "Medium Bangs", face: "Suspicious", colors: { skin: SKIN[3], top: C.violet } }) },
  wijzen: { alt: "Een man wijst iets aan.", draw: () => stand({ pose: "standing/pointing_finger-1", head: "Gray Short", glasses: "Glasses 2", colors: { skin: SKIN[1], hair: "#c9ccd2", top: C.green, pants: C.navy } }) },
  lopen: { alt: "Een vrouw loopt.", draw: () => stand({ pose: "standing/walking-1", head: "Long", colors: { skin: SKIN[2], top: C.orange, pants: C.denim } }) },
  dokter: { alt: "Een dokter.", draw: () => stand({ pose: "standing/doctor-nurse-01", head: "Short 3", beard: "Goatee 1", colors: { skin: SKIN[3], top: C.white, jacket: C.white, pants: C.sky2 } }) },
  oma: { alt: "Een oma.", draw: () => stand({ pose: "standing/blazer-3", head: "Gray Bun", glasses: "Glasses 5", colors: { skin: SKIN[0], hair: "#e8e1e1", jacket: C.violet, top: C.white, pants: C.navy } }) },
  fietser: { alt: "Een vrouw op de fiets.", draw: () => peep({ x: 96, y: 214, h: 168, pose: "sitting/bike", head: "Medium 3", colors: { skin: SKIN[1], top: C.teal, jacket: C.teal, pants: C.navy } }) },
  rolstoel: { alt: "Een man in een rolstoel.", draw: () => peep({ x: 90, y: 214, h: 226, pose: "sitting/wheelchair", head: "Short 1", colors: { skin: SKIN[3], top: C.rose, jacket: C.sky2, pants: C.denim } }) },
  // animals
  hond: { alt: "Een hond.", draw: () => big(2, dogShape(), 84, 206) },
  kat: { alt: "Een kat.", draw: () => big(1.4, cat(), 92, 206) },
  koe: { alt: "Een koe.", draw: () => big(1.35, cowShape(), 92, 196) },
  eend: { alt: "Een eend.", draw: () => big(1.3, duck(), 84, 196) },
  // objects
  huis: { alt: "Een Nederlands huis.", draw: () => gable(40, 214, 120, 200, C.brick, true, "step") },
  molen: { alt: "Een molen.", draw: () => big(1.05, windmill(0, 0), 100, 214) },
  fiets: { alt: "Een fiets.", draw: () => big(1.8, bike(0, 0, C.teal), 100, 160) },
  tulpen: { alt: "Tulpen.", draw: () => big(2.8, tulips(-18, 0, [C.red, C.yellow, C.rose, C.orange]), 100, 200) },
  klok: { alt: "Een klok.", draw: () => big(2.2, clock(0, 0, 40, 3, 0), 100, 110) },
  kalender: { alt: "Een kalender.", draw: () => big(1, calendarBig(), 100, 200) },
  brief: { alt: "Een brief in een envelop.", draw: () => big(1, envelope(0, -60, 150, 96, C.white) + g(rect(-50, -100, 100, 60, C.paperDoc, 3, true) + stroke("M-36-84H36M-36-72H20", C.grey, 3), "rotate(-6)"), 100, 210) },
  geld: { alt: "Een portemonnee met geld.", draw: () => big(1, wallet(), 100, 200) },
  sleutels: { alt: "Sleutels.", draw: () => big(1.3, keysBig(), 104, 170) },
  medicijnen: { alt: "Medicijnen.", draw: () => big(1, pills(), 90, 210) },
  boek: { alt: "Een boek.", draw: () => big(2.6, openBook(0, 0), 100, 150) },
  telefoon: { alt: "Een telefoon.", draw: () => big(7, phone(0, 0), 100, 110) },
  verhuisdoos: { alt: "Een verhuisdoos.", draw: () => big(2, box(-30, 0, 60, 50), 100, 190) },
  bloemen: { alt: "Een bos bloemen.", draw: () => big(1.3, flowersBig(), 100, 206) },
  stembus: { alt: "Een stembus.", draw: () => big(1.2, ballot(), 100, 210) },
  diploma: { alt: "Een studentenhoed en een boek.", draw: () => big(1, graduation(), 100, 200) },
  plant: { alt: "Een plant.", draw: () => big(2.1, plant(0, 0), 100, 212) },
  computer: { alt: "Een laptop.", draw: () => big(2.4, laptop(0, 0), 100, 160) },
};

// The dog and cow of the scenes, at their own origin.
function dogShape() {
  const color = "#c98b52";
  const leg = (lx: number) => rect(lx, -24, 7, 24, color, 3, true);
  return (
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
    rect(16, -44, 8, 5, C.red, 1, true)
  );
}

function cowShape() {
  const leg = (lx: number) => rect(lx, -40, 9, 38, C.white, 3, true) + rect(lx, -8, 9, 8, INK, 2);
  return (
    rect(-30, -40, 9, 36, "#e6e6e6", 3, true) +
    rect(30, -40, 9, 36, "#e6e6e6", 3, true) +
    stroke("M-48-70Q-58-56-54-30", INK, 2) +
    path("M-58-34Q-54-24-50-34Q-53-38-58-34Z", INK) +
    leg(-42) +
    leg(18) +
    path("M-46-74Q-48-84-36-84H30Q42-84 44-72V-48Q44-36 32-36H-36Q-48-36-48-48Z", C.white, true) +
    path("M-30-84H-4Q-2-70-12-62Q-26-58-30-70Z", INK) +
    path("M8-60Q20-66 30-56Q32-44 18-40Q4-42 8-60Z", INK) +
    path("M-46-56Q-36-54-36-44Q-38-38-46-40Z", INK) +
    ellipse(-30, -34, 9, 5, "#f3b4b4", true) +
    path("M36-80Q48-92 60-84L70-60Q72-50 62-48H54Q46-50 44-58Z", C.white, true) +
    path("M40-80Q50-90 58-84L60-74Q50-74 44-70Z", INK) +
    ellipse(64, -52, 9, 7, "#f3b4b4", true) +
    circle(61, -53, 1.4, INK) +
    circle(67, -53, 1.4, INK) +
    circle(55, -70, 1.6, INK) +
    path("M40-82Q30-88 28-80Q34-76 42-78Z", C.white, true) +
    path("M48-88Q50-96 54-94Q52-90 52-86Z", C.paperDoc, true)
  );
}
