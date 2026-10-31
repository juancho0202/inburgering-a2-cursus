/**
 * Drawings outside the lessons (npm run illustrations): the picture at the top of the landing page and the maker's
 * portrait on the About page. Same kit and people as the lesson scenes.
 */
import { C, INK, SKIN, circle, ellipse, g, gable, path, rect, stroke, text } from "./kit.js";
import { peep } from "./peeps.js";

/** A pink flower with a yellow heart, as on a cactus. */
const flower = (x: number, y: number, s = 1, a = 0) =>
  g(
    [0, 72, 144, 216, 288].map((r) => g(ellipse(0, -9, 5.5, 9, "#f4a7bd", true), `rotate(${r})`)).join("") + circle(0, 0, 4.5, "#f6dc8a", true),
    `translate(${x} ${y}) rotate(${a}) scale(${s})`,
  );

/** A pot with two round cacti in flower and a heart on the front. `base`: the bottom of the pot. */
function cactus(x: number, base: number, s = 1) {
  const green = "#a9d39a";
  const rib = "#5e8f52";
  const spines = (pts: [number, number, number][]) => pts.map(([px, py, a]) => g(stroke("M0 0V-5", INK, 1.6), `translate(${px} ${py}) rotate(${a})`)).join("");
  return g(
    // the tall one behind, the small one in front of it
    ellipse(9, -86, 23, 37, green, true) +
      stroke("M9 -122C0 -104 -1 -72 3 -52M9 -122C19 -104 21 -72 16 -52", rib, 1.6) +
      spines([[-12, -100, -70], [30, -96, 70], [24, -118, 40], [-6, -118, -40]]) +
      ellipse(-15, -64, 18, 21, green, true) +
      stroke("M-15 -84C-22 -72 -22 -58 -19 -46M-15 -84C-7 -72 -6 -58 -9 -46", rib, 1.6) +
      spines([[-31, -70, -80], [-24, -82, -40], [1, -76, 60]]) +
      flower(-3, -116, 1, 10) +
      flower(33, -72, 0.9, 30) +
      flower(-33, -62, 0.85, -20) +
      // the pot: body, rim, a shine and the heart
      path("M-25 0L-29 -42H29L25 0Z", "#f1b48f", true) +
      rect(-33, -52, 66, 14, "#f5c3a2", 4, true) +
      stroke("M-20 -34V-24", "#ffffffaa", 3) +
      path("M0 -11C-12 -18 -11 -29 -4 -29C-1 -29 0 -26 0 -24C0 -26 1 -29 4 -29C11 -29 12 -18 0 -11Z", "#fbe7b0", true),
    `translate(${x} ${base}) scale(${s})`,
  );
}

/** A learner at the laptop on a warm background, with a few lesson bits floating around. 480 × 360. */
export function hero(): string {
  const W = 480;
  const H = 360;
  const chip = (x: number, y: number, label: string, fill: string, color = INK, a = 0) =>
    g(rect(-label.length * 5.4 - 14, -17, label.length * 10.8 + 28, 34, fill, 17, true) + text(0, 6, label, 16, color, 800), `translate(${x} ${y}) rotate(${a})`);
  return (
    rect(0, 0, W, H, "#fdf0e1", 28) +
    // a soft blob behind the learner, like a spotlight
    path("M96 300C40 250 60 120 170 92C280 64 420 96 430 200C440 290 360 330 250 326C170 324 130 330 96 300Z", "#fbdcb8") +
    // canal houses far away, through the blob
    g(gable(0, 0, 46, 70, "#f3c79a", false, "bell") + gable(50, 0, 40, 86, "#efbb88", false, "step") + gable(94, 0, 44, 64, "#f3c79a", false, "point"), "translate(300 152)") +
    // the learner with the laptop on her lap, typing; the body runs off the bottom edge
    peep({ x: 214, y: H + 26, h: 640, pose: "body/Macbook", head: "Medium Bangs", face: "Smile", colors: { skin: SKIN[2], top: C.yellow, accent: C.grey } }) +
    cactus(64, H - 10, 1.05) +
    // what the lessons give back
    chip(108, 110, "de / het", C.white, INK, -8) +
    chip(380, 84, "✓ Goed zo!", "#e3f4e8", "#1f7a3d", 6) +
    chip(410, 236, "A2", C.orange, C.white, -6) +
    g(circle(0, 0, 18, C.white, true) + stroke("M-6 -4V4M0 -8V8M6 -4V4", C.orange, 3), "translate(236 52)")
  );
}

/** The maker with his coffee, in an orange circle (the About page). 240 × 240. */
export function maker(): string {
  const S = 240;
  return (
    `<defs><clipPath id="maker-circle"><circle cx="${S / 2}" cy="${S / 2}" r="${S / 2}"/></clipPath></defs>` +
    `<g clip-path="url(#maker-circle)">` +
    circle(S / 2, S / 2, S / 2, C.orange) +
    peep({ x: 131, y: 308, h: 644, pose: "body/Coffee", head: "Pomp", face: "Smile", beard: "Full", colors: { skin: SKIN[1], hair: "#1f1a17", top: C.white, accent: C.navy } }) +
    `</g>`
  );
}
