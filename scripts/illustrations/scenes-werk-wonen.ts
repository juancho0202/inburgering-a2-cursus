/** Scenes for the KNM lessons about work and housing. */
import { C, FLOOR, INK, SKIN, W, box, bubble, circle, clock, cloud, counter, cup, ellipse, frame, g, letter, path, plant, rect, room, shelf, sign, stroke, table, text, tree, window } from "./kit.js";
import { peep, reach, type Peep } from "./peeps.js";
import type { Scene } from "./scenes.js";

const TALL = 236;

// ---------- props ----------

function cv(x: number, y: number, title: string, a = 0) {
  let lines = "";
  for (let i = 0; i < 4; i++) lines += stroke(`M-16 ${-6 + i * 7}H${i % 2 ? 8 : 16}`, C.grey, 1.6);
  return g(path("M-24 18L-20-24H24L20 18Z", C.white, true) + text(0, -12, title, 8, C.navy, 800) + lines, `translate(${x} ${y}) rotate(${a})`);
}

const pen = (x: number, y: number) => stroke(`M${x} ${y}l22-8`, C.navy, 3.5) + stroke(`M${x} ${y}l3-1`, INK, 3.5);

function bedWithBlanket(x: number, top: number, w: number, part: "back" | "front") {
  if (part === "back") return rect(x - 10, top - 110, 20, 170, C.woodDark, 4, true) + ellipse(x + 50, top - 60, 46, 18, C.white, true);
  return path(`M${x} ${top - 34}Q${x + w / 2} ${top - 54} ${x + w} ${top - 30}V${top + 30}H${x}Z`, C.sky2, true) + stroke(`M${x + 20} ${top - 20}Q${x + w / 2} ${top - 34} ${x + w - 20} ${top - 16}`, "#ffffff66", 3) + rect(x, top + 30, w, 12, C.woodDark, 2, true) + rect(x + 4, top + 42, 8, 18, C.woodDark) + rect(x + w - 12, top + 42, 8, 18, C.woodDark);
}

const thermometer = (x: number, y: number) => rect(x - 3, y - 30, 6, 30, C.white, 3, true) + circle(x, y, 5, C.red, true) + rect(x - 1, y - 20, 2, 18, C.red);

const tissues = (x: number, y: number) => rect(x - 18, y - 18, 36, 18, C.sky, 3, true) + path(`M${x - 6} ${y - 18}Q${x} ${y - 32} ${x + 6} ${y - 18}Z`, C.white, true);

function sink(x: number, base: number) {
  return (
    rect(x, base - 96, 150, 96, C.white, 3, true) +
    rect(x - 6, base - 104, 162, 12, C.grey, 3, true) +
    stroke(`M${x + 75} ${base - 104}V${base - 128}h18v8`, C.grey, 6) +
    stroke(`M${x + 75} ${base - 104}V${base - 128}h18v8`, INK, 1) +
    [0, 1, 2].map((i) => ellipse(x + 93, base - 112 + i * 14, 2.5, 4, C.water)).join("") +
    rect(x + 20, base - 80, 50, 70, "#eef0f2", 2, true) +
    rect(x + 80, base - 80, 50, 70, "#eef0f2", 2, true)
  );
}

function toolbox(x: number, base: number) {
  return rect(x, base - 26, 60, 26, C.red, 3, true) + path(`M${x + 16} ${base - 26}V${base - 36}H${x + 44}V${base - 26}`, "none", true) + stroke(`M${x + 70} ${base - 4}l26-8`, C.grey, 5);
}

function van(x: number, base: number) {
  return (
    path(`M${x} ${base - 16}V${base - 140}H${x + 170}V${base - 16}Z`, C.white, true) +
    path(`M${x + 170} ${base - 16}V${base - 100}H${x + 214}L${x + 240} ${base - 64}V${base - 16}Z`, C.white, true) +
    path(`M${x + 178} ${base - 92}H${x + 210}L${x + 230} ${base - 66}H${x + 178}Z`, C.sky, true) +
    rect(x + 10, base - 130, 150, 106, "#5b4636", 2) +
    rect(x + 4, base - 56, 160, 6, C.grey) +
    circle(x + 40, base - 14, 15, C.black, true) +
    circle(x + 40, base - 14, 5, C.grey) +
    circle(x + 196, base - 14, 15, C.black, true) +
    circle(x + 196, base - 14, 5, C.grey)
  );
}

function container(x: number, base: number, color: string, label: string, sub: string) {
  return rect(x, base - 120, 80, 120, color, 10, true) + rect(x + 16, base - 92, 48, 8, INK, 4) + text(x + 40, base - 52, label, 13, C.white, 800) + text(x + 40, base - 36, sub, 9, C.white, 600);
}

const bottle = (x: number, y: number) => path(`M${x - 5} ${y + 22}V${y + 4}Q${x - 5} ${y - 2} ${x - 2} ${y - 4}V${y - 12}H${x + 2}V${y - 4}Q${x + 5} ${y - 2} ${x + 5} ${y + 4}V${y + 22}Z`, C.green, true);

// ---------- scenes ----------

const sollicitatie: Scene = {
  alt: "Een sollicitatiegesprek. De werkgever leest het cv van een vrouw.",
  draw: () => {
    const top = 236;
    const boss: Peep = { x: 340, y: top + 8, h: 330, pose: "body/Button Shirt 2", head: "Short 4", glasses: "Glasses 3", face: "Explaining", flip: true, colors: { skin: SKIN[1], hair: "#7a5236", top: C.sky2 } };
    const cand: Peep = { x: 140, y: top + 8, h: 330, pose: "body/Blazer Black Tee", head: "Medium Bangs", face: "Smile", colors: { skin: SKIN[3], jacket: C.navy, top: C.white } };
    return (
      room(C.wallBlue, C.floorGrey) +
      window(190, 40, 100, 90, "houses") +
      frame(20, 40, 70, 54) +
      plant(440, FLOOR + 14) +
      peep(cand) +
      peep(boss) +
      table(40, top, 400, C.white) +
      cv(250, top - 18, "CV", -8) +
      cup(110, top - 4, C.white) +
      bubble(360, 70, "Waarom wilt u hier werken?", { tail: "down", size: 13 })
    );
  },
};

const contract: Scene = {
  alt: "Een nieuwe werknemer tekent zijn arbeidscontract.",
  draw: () => {
    const top = 236;
    const boss: Peep = { x: 340, y: top + 8, h: 330, pose: "body/Explaining", head: "Gray Bun", glasses: "Glasses 4", face: "Explaining", flip: true, colors: { skin: SKIN[0], hair: "#e8e1e1", top: C.violet } };
    const emp: Peep = { x: 140, y: top + 8, h: 330, pose: "body/Polo and Sweater", head: "Short 2", beard: "Moustache 2", colors: { skin: SKIN[4], top: C.green } };
    return (
      room(C.wallGreen, C.floorGrey) +
      window(20, 40, 90, 90, "trees") +
      clock(200, 60, 20, 9, 0) +
      shelf(380, 120, 80) +
      peep(emp) +
      peep(boss) +
      table(40, top, 400, C.white) +
      g(
        path("M-40 22L-34-24H40L34 22Z", C.white, true) +
          text(0, -12, "ARBEIDSCONTRACT", 7, C.navy, 800) +
          text(0, 0, "Loon: € 2.400 bruto", 7, INK, 600) +
          text(0, 10, "Uren: 32 per week", 7, INK, 600) +
          stroke("M-24 18H8", INK, 1),
        `translate(236 ${top - 22}) rotate(-4)`,
      ) +
      pen(272, top - 6) +
      bubble(340, 70, "Hier tekenen, alstublieft.", { tail: "down", size: 13 })
    );
  },
};

const ziekmelden: Scene = {
  alt: "Een man is ziek. Hij ligt in bed en meldt zich ziek bij zijn werk.",
  draw: () => {
    const top = 240;
    const p: Peep = { x: 210, y: top - 10, h: 330, pose: "body/Device", head: "Short 3", face: "Tired", colors: { skin: SKIN[1], top: C.sky } };
    return (
      room(C.wallLilac) +
      window(330, 40, 110, 100, "sky") +
      frame(40, 50, 70, 54) +
      bedWithBlanket(150, top, 260, "back") +
      peep(p) +
      bedWithBlanket(150, top, 260, "front") +
      rect(40, 200, 80, 60, C.wood, 3, true) +
      rect(44, 260, 8, 40, C.woodDark) +
      rect(108, 260, 8, 40, C.woodDark) +
      cup(62, 200, C.orange) +
      tissues(98, 200) +
      thermometer(76, 186).replace(/translate/, "translate") +
      bubble(250, 60, "Ik ben ziek. Ik kom vandaag niet.", { tail: "down", size: 13 })
    );
  },
};

const reparatie: Scene = {
  alt: "De kraan lekt. De huisbaas komt hem repareren.",
  draw: () => {
    const fixer: Peep = { x: 300, y: 304, h: TALL, pose: "sitting/mid-1", head: "Gray Short", glasses: "Glasses 2", face: "Driven", flip: true, colors: { skin: SKIN[0], hair: "#c9ccd2", top: C.navy, pants: C.denim } };
    const tenant: Peep = { x: 110, y: 304, h: TALL, pose: "standing/crossed_arms-1", head: "Long Curly", face: "Concerned", colors: { skin: SKIN[3], top: C.orange, pants: C.navy } };
    return (
      room(C.wall) +
      rect(260, 40, 200, 110, C.wood, 0, true) +
      stroke("M360 40V150", INK, 1.5) +
      sink(290, FLOOR + 10) +
      window(170, 76, 76, 70, "houses") +
      peep(tenant) +
      peep(fixer) +
      toolbox(150, 300) +
      bubble(110, 54, "De kraan lekt al een week.", { tail: "down", size: 13 })
    );
  },
};

const verhuisbus: Scene = {
  alt: "Twee vrienden laden dozen in een verhuisbus.",
  draw: () => {
    const a: Peep = { x: 350, y: 308, h: TALL, pose: "standing/robot_dance-2", head: "Short 5", flip: true, colors: { skin: SKIN[3], top: C.yellow, pants: C.denim } };
    const b: Peep = { x: 420, y: 308, h: 228, pose: "standing/blazer-4", head: "Long", face: "Smile", flip: true, colors: { skin: SKIN[0], top: C.white, jacket: C.green, pants: C.navy } };
    const [hx, hy] = reach(a);
    return (
      rect(0, 0, W, 320, C.sky) +
      cloud(400, 34) +
      tree(450, 252, 0.9) +
      rect(0, 250, W, 70, C.street) +
      rect(0, 246, W, 8, C.pavement, 0, true) +
      van(30, 296) +
      box(48, 268, 56, 44, "KEUKEN") +
      box(110, 268, 50, 40) +
      box(60, 224, 44, 36) +
      peep(a) +
      peep(b) +
      box(hx - 30, hy + 30, 46, 40, "BOEKEN") +
      bubble(400, 54, "Nog drie dozen!", { tail: "left", size: 14 })
    );
  },
};

const afval: Scene = {
  alt: "Een vrouw brengt een fles naar de glasbak. Er zijn containers voor glas, papier en plastic.",
  draw: () => {
    const p: Peep = { x: 110, y: 308, h: TALL, pose: "standing/robot_dance-1", head: "Hijab", face: "Smile", colors: { skin: SKIN[2], scarf: C.green, top: C.violet, pants: C.navy } };
    const [hx, hy] = reach(p);
    return (
      rect(0, 0, W, 320, C.sky) +
      cloud(80, 40) +
      tree(40, 250, 1) +
      rect(0, 250, W, 70, C.pavement) +
      stroke("M0 252H480", INK, 2) +
      container(190, 296, C.green, "GLAS", "flessen, potten") +
      container(280, 296, C.sky2, "PAPIER", "karton, kranten") +
      container(370, 296, C.orange, "PLASTIC", "pak, blik, plastic") +
      peep(p) +
      bottle(hx + 6, hy - 18) +
      bubble(118, 46, "Glas gaat in de glasbak.", { tail: "down", size: 13 })
    );
  },
};

export const werkWonenScenes: Record<string, Scene> = { sollicitatie, contract, ziekmelden, reparatie, verhuisbus, afval };

void [counter, letter, sign];
