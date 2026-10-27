/** Scenes for the Lezen and Schrijven lessons: things people read and write in daily life. */
import { C, FLOOR, INK, SKIN, W, bubble, circle, clock, cloud, cup, ellipse, g, gable, lamp, openBook, path, phone, plant, rect, room, shelf, sign, stroke, sun, table, text, window } from "./kit.js";
import { peep, reach, type Peep } from "./peeps.js";
import type { Scene } from "./scenes.js";

const TALL = 236;

// ---------- props ----------

/** A chat message as it looks on a phone, with its tail on the right (pointing at the phone it is on). */
function chat(x: number, y: number, lines: string[], color = "#dcf8c6") {
  const w = Math.max(...lines.map((l) => l.length)) * 7.2 + 24;
  const h = lines.length * 16 + 14;
  const [x1, y1] = [x + w, y + h];
  return (
    path(`M${x + 8} ${y}H${x1 - 8}Q${x1} ${y} ${x1} ${y + 8}V${y1 - 22}L${x1 + 14} ${y1 - 8}L${x1} ${y1 - 10}V${y1 - 8}Q${x1} ${y1} ${x1 - 8} ${y1}H${x + 8}Q${x} ${y1} ${x} ${y1 - 8}V${y + 8}Q${x} ${y} ${x + 8} ${y}Z`, color, true) +
    lines.map((l, i) => text(x + 10, y + 20 + i * 16, l, 12, INK, 600, "start")).join("") +
    text(x1 - 6, y1 - 3, "08:12 ✓✓", 8, C.sky2, 700, "end")
  );
}

function tramInside() {
  let windows = "";
  for (let i = 0; i < 3; i++) {
    const x = 20 + i * 160;
    windows += rect(x, 40, 130, 100, C.white, 8, true) + rect(x + 6, 46, 118, 88, C.sky, 6) + gable(x + 14, 134, 30, 50, C.brick3, false) + gable(x + 50, 134, 34, 64, C.brick, false) + gable(x + 88, 134, 28, 44, C.brick2, false);
  }
  return rect(0, 0, W, 320, "#e9ecef") + windows + rect(0, 150, W, 6, C.grey) + stroke("M150 0V320M330 0V320", C.yellow, 6) + stroke("M150 0V320M330 0V320", INK, 1);
}

function shopFront(x: number, w: number) {
  return (
    rect(x, 30, w, 230, "#2f6f86", 0, true) +
    rect(x, 30, w, 40, C.navy, 0, true) +
    text(x + w / 2, 58, "BAKKERIJ", 18, C.white, 800) +
    rect(x + 20, 90, 170, 140, C.sky, 3, true) +
    [0, 1, 2].map((i) => ellipse(x + 60 + i * 50, 220, 20, 10, "#d9a066", true)).join("") +
    rect(x + 220, 90, 90, 170, "#cfe8f7", 3, true) +
    circle(x + 296, 180, 4, C.yellow, true)
  );
}

const notice = (x: number, y: number, lines: string[]) =>
  g(rect(-48, 0, 96, 22 + lines.length * 14, C.white, 2, true) + rect(-48, 0, 96, 18, C.red, 2, true) + text(0, 13, lines[0], 11, C.white, 800) + lines.slice(1).map((l, i) => text(0, 34 + i * 14, l, 10, INK, 700)).join(""), `translate(${x} ${y}) rotate(-2)`);

function bookcase(x: number, y: number, w: number, rows: number) {
  let out = rect(x, y, w, rows * 50 + 10, C.woodDark, 3, true);
  const colors = [C.rose, C.sky2, C.yellow, C.teal, C.orange, C.violet, C.green];
  for (let r = 0; r < rows; r++) {
    const by = y + 10 + r * 50;
    out += rect(x + 6, by, w - 12, 40, "#f3e2c7");
    for (let i = 0, bx = x + 10; bx < x + w - 18; i++) {
      const bw = 8 + ((i * 5 + r * 3) % 7);
      const bh = 26 + ((i * 7 + r) % 12);
      out += rect(bx, by + 40 - bh, bw, bh, colors[(i + r * 2) % colors.length], 1, true);
      bx += bw + 2;
    }
  }
  return out;
}

function form(x: number, y: number) {
  const fields = ["Achternaam", "Voornaam", "Geboortedatum", "Adres", "Handtekening"];
  let out = path(`M${x - 92} ${y}L${x - 80} ${y - 120}H${x + 80}L${x + 92} ${y}Z`, C.white, true) + text(x, y - 104, "AANMELDFORMULIER", 9, C.navy, 800);
  fields.forEach((f, i) => {
    const fy = y - 86 + i * 18;
    out += text(x - 66, fy + 4, f, 8, INK, 600, "start") + stroke(`M${x + 2} ${fy + 6}H${x + 70}`, C.grey, 1.2);
  });
  out += text(x + 6, y - 78, "Yilmaz", 10, C.sky2, 700, "start") + text(x + 6, y - 60, "Ayşe", 10, C.sky2, 700, "start");
  return out;
}

function folderRack(x: number, y: number) {
  const items: [string, string][] = [
    ["GGD", C.teal],
    ["Afval", C.green],
    ["Zorg", C.sky2],
    ["Taal", C.orange],
    ["Werk", C.violet],
    ["Wonen", C.rose],
  ];
  let out = rect(x, y, 150, 150, C.wood, 3, true);
  items.forEach(([label, c], i) => {
    const fx = x + 10 + (i % 3) * 46;
    const fy = y + 12 + Math.floor(i / 3) * 70;
    out += rect(fx, fy, 38, 54, c, 2, true) + text(fx + 19, fy + 22, label, 9, C.white, 800) + rect(fx - 2, fy + 40, 42, 16, C.woodDark, 2, true);
  });
  return out;
}

function fridgeNote(x: number, base: number) {
  return (
    rect(x, base - 200, 110, 200, C.white, 8, true) +
    stroke(`M${x} ${base - 130}H${x + 110}`, INK, 2) +
    rect(x + 92, base - 190, 6, 40, C.grey, 2, true) +
    rect(x + 92, base - 116, 6, 50, C.grey, 2, true) +
    g(
      rect(-38, -30, 76, 64, "#fff6a8", 2, true) +
        circle(0, -26, 5, C.red, true) +
        ["Ben om 6 uur", "thuis.", "Kook jij?", "Sara"].map((l, i) => text(0, -10 + i * 12, l, 9, INK, i === 3 ? 800 : 600)).join(""),
      `translate(${x + 46} ${base - 92}) rotate(3)`,
    )
  );
}

function windbreak(x: number, base: number) {
  let out = "";
  for (let i = 0; i < 6; i++) out += rect(x + i * 20, base - 60, 20, 56, i % 2 ? C.white : C.sky2, 0, true);
  for (let i = 0; i <= 6; i++) out += stroke(`M${x + i * 20} ${base - 66}V${base}`, C.woodDark, 3);
  return out;
}

const parasol = (x: number, base: number) => stroke(`M${x} ${base}V${base - 120}`, INK, 3) + path(`M${x - 60} ${base - 106}Q${x} ${base - 160} ${x + 60} ${base - 106}Z`, C.orange, true) + path(`M${x - 20} ${base - 106}Q${x} ${base - 150} ${x + 20} ${base - 106}Z`, C.white, true);

// ---------- scenes ----------

const tram: Scene = {
  alt: "In de tram leest een vrouw een bericht op haar telefoon.",
  draw: () => {
    // Seated pose: the hips are 66 above the feet, so the cushions are at 296 - 66.
    // She looks left, at the phone in her hand (the chat bubble next to it is her message).
    const p: Peep = { x: 260, y: 296, h: TALL, pose: "sitting/crossed_legs", head: "Bun", face: "Calm", flip: true, colors: { skin: SKIN[3], top: C.rose, pants: C.navy } };
    const q: Peep = { x: 430, y: 296, h: TALL, pose: "sitting/crossed_legs", head: "Short 1", glasses: "Glasses", flip: true, colors: { skin: SKIN[0], top: C.grey, pants: C.denim } };
    const seat = (x: number, w: number) => rect(x, 150, w, 84, "#4a90d9", 10, true) + rect(x - 4, 224, w + 8, 22, "#3b78bd", 8, true) + rect(x + w / 2 - 6, 246, 12, 36, C.grey, 0, true);
    return (
      tramInside() +
      rect(170, 8, 150, 26, INK, 4) +
      text(245, 26, "Volgende halte: Centraal", 10, C.yellow, 700) +
      rect(0, 280, W, 40, C.floorGrey) +
      seat(180, 136) +
      seat(360, 126) +
      peep(p) +
      phone(234, 196, 25) +
      peep(q) +
      // a folded newspaper in the hands that hold the knee (mirrored for the flipped pose)
      g(rect(-20, -14, 40, 28, C.paperDoc, 2, true) + text(0, -3, "KRANT", 7, INK, 800) + stroke("M-14 4H14M-14 9H4", C.grey, 1.4), "translate(400 192) rotate(18)") +
      chat(20, 150, ["Hoi! Ik ben tien", "minuten te laat.", "Sorry! Marco"])
    );
  },
};

const mededeling: Scene = {
  alt: "Een man leest een mededeling op de deur van de bakkerij: vandaag gesloten.",
  draw: () => {
    const p: Peep = { x: 150, y: 306, h: TALL, pose: "standing/resting-2", head: "Flat Top", face: "Concerned", colors: { skin: SKIN[4], top: C.yellow, pants: C.denim } };
    return (
      rect(0, 0, W, 320, C.sky) +
      shopFront(110, 340) +
      rect(0, 260, W, 60, C.pavement) +
      stroke("M0 262H480", INK, 2) +
      notice(375, 110, ["GESLOTEN", "wegens ziekte", "Morgen weer", "open vanaf 8.00"]) +
      peep(p) +
      bubble(110, 50, "O nee, vandaag dicht!", { tail: "down", size: 13 })
    );
  },
};

const bibliotheek: Scene = {
  alt: "In de bibliotheek. Een man leest een boek aan tafel.",
  draw: () => {
    const top = 240;
    const p: Peep = { x: 300, y: top + 8, h: 330, pose: "body/Explaining", head: "Medium 1", glasses: "Glasses 5", face: "Calm", colors: { skin: SKIN[2], top: C.teal } };
    return (
      room(C.wall, "#d8c3a5") +
      bookcase(20, 40, 170, 4) +
      sign(220, 20, 120, "Bibliotheek", C.navy, C.white, 14) +
      rect(380, 30, 80, 30, C.white, 4, true) +
      text(420, 50, "Stil a.u.b.", 11, C.red, 800) +
      lamp(352, 80) +
      peep(p) +
      table(200, top, 260) +
      openBook(300, top - 4) +
      cup(420, top - 4, C.white)
    );
  },
};

const formulier: Scene = {
  alt: "Een vrouw vult een aanmeldformulier in: naam, geboortedatum, adres en handtekening.",
  draw: () => {
    const top = 250;
    const p: Peep = { x: 120, y: top + 8, h: 330, pose: "body/Explaining", head: "Long", face: "Driven", colors: { skin: SKIN[1], top: C.orange } };
    return (
      room(C.wallBlue) +
      window(320, 40, 120, 90, "houses") +
      clock(240, 60, 18, 2, 30) +
      peep(p) +
      table(20, top, 440) +
      form(300, top - 4) +
      stroke(`M210 ${top - 16}l26-10`, C.navy, 4) +
      plant(440, top - 4, 0.7)
    );
  },
};

const folder: Scene = {
  alt: "In de wachtkamer pakt een man een folder uit het rek.",
  draw: () => {
    const p: Peep = { x: 170, y: 306, h: TALL, pose: "standing/robot_dance-1", head: "Short 1", beard: "Full", colors: { skin: SKIN[2], top: C.sky2, pants: C.navy } };
    const [hx, hy] = reach(p);
    return (
      room(C.wallGreen, C.floorGrey) +
      folderRack(260, 80) +
      sign(30, 24, 130, "Wachtkamer", C.navy, C.white, 13) +
      rect(30, 200, 70, 50, C.sky2, 8, true) +
      rect(30, 250, 6, 40, INK) +
      rect(94, 250, 6, 40, INK) +
      plant(440, FLOOR + 14) +
      peep(p) +
      rect(hx - 4, hy - 22, 26, 36, C.teal, 2, true) +
      text(hx + 9, hy - 4, "GGD", 7, C.white, 800)
    );
  },
};

const briefje: Scene = {
  alt: "Op de koelkast hangt een briefje: Ben om 6 uur thuis. Kook jij? Sara.",
  draw: () => {
    const p: Peep = { x: 150, y: 306, h: TALL, pose: "standing/pointing_finger-1", head: "Shaved 3", face: "Smile", colors: { skin: SKIN[0], top: C.teal, pants: C.denim } };
    return (
      room(C.wall) +
      rect(0, 150, 100, 100, C.wood, 0, true) +
      rect(0, 144, 100, 8, C.woodDark, 2, true) +
      window(30, 40, 60, 80, "trees") +
      clock(400, 50, 18, 5, 50) +
      fridgeNote(290, FLOOR + 10) +
      peep(p) +
      bubble(140, 52, "Oké, ik kook!", { tail: "down", size: 15 })
    );
  },
};

const strand: Scene = {
  alt: "Op het strand. Een vrouw schrijft een kaartje aan een vriendin: groetjes uit Zandvoort!",
  draw: () => {
    const p: Peep = { x: 200, y: 300, h: TALL, pose: "sitting/one_leg_up-2", head: "Medium Straight", face: "Smile", colors: { skin: SKIN[3], top: C.yellow, pants: C.sky2 } };
    return (
      rect(0, 0, W, 320, C.sky) +
      sun(420, 50) +
      cloud(120, 40) +
      rect(0, 150, W, 50, "#5aa0d6") +
      stroke("M20 166h50M140 176h60M300 168h50M400 180h40", C.white, 2) +
      path("M0 196Q240 186 480 196V320H0Z", "#f2dca6") +
      windbreak(310, 280) +
      parasol(110, 290) +
      ellipse(220, 296, 110, 16, C.rose, true) +
      peep(p) +
      g(rect(-26, -18, 52, 36, C.white, 2, true) + text(0, -4, "Groetjes", 8, C.sky2, 800) + text(0, 8, "uit Zandvoort!", 7, INK, 700), "translate(270 244) rotate(-8)") +
      bubble(250, 60, "Lieve Nina, het is hier heerlijk!", { size: 13, think: [200, 120] })
    );
  },
};

export const lezenSchrijvenScenes: Record<string, Scene> = { tram, mededeling, bibliotheek, formulier, folder, briefje, strand };

void [shelf, circle];
