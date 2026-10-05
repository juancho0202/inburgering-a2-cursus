import { expect, test } from "@playwright/test";
import { answerOne, openMenu, startFresh } from "./helpers";

test("first visit: welcome screen once, then the dashboard with all modules", async ({ page }) => {
  await startFresh(page);
  for (const name of ["Basis Nederlands", "Lezen A2", "Kennis van de Nederlandse Maatschappij", "Schrijven A2", "Proefexamens"]) {
    await expect(page.getByRole("heading", { name })).toBeVisible();
  }
  await expect(page.getByText("Niet van DUO")).toBeVisible();
  await page.goto("/"); // second visit: no welcome screen
  await expect(page.getByRole("heading", { name: /Welkom terug/ })).toBeVisible();
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
  await p.goto("/");
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
