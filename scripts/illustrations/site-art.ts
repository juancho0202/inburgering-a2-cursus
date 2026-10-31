/**
 * Drawings outside the lessons (npm run illustrations): the picture at the top of the landing page and the maker's
 * portrait on the About page. Same kit and people as the lesson scenes.
 */
import { C, INK, SKIN, circle, g, gable, path, plant, rect, stroke, text } from "./kit.js";
import { peep } from "./peeps.js";

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
    plant(54, H - 8, 1.25) +
    // what the lessons give back
    chip(108, 110, "de / het", C.white, INK, -8) +
    chip(380, 84, "✓ Goed zo!", "#e3f4e8", "#1f7a3d", 6) +
    chip(410, 236, "A2", C.orange, C.white, -6) +
    g(circle(0, 0, 18, C.white, true) + stroke("M-6 -4V4M0 -8V8M6 -4V4", C.orange, 3), "translate(70 196)")
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
