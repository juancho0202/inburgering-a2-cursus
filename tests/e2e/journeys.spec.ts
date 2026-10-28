import { expect, test, type Page } from "@playwright/test";
import { answerOne, startFresh } from "./helpers";

/** Matching exercise (the ones in basis-tijd): pair each phrase with its clock time. */
async function matchPairs(page: Page) {
  const pairs: Record<string, string> = { "half twee": "1.30", "kwart over negen": "9.15", "tien voor vijf": "4.50", "vijf over half zes": "5.35", dertien: "13", dertig: "30", zeventien: "17", zeventig: "70", "8.00 uur": "'s ochtends", "15.00 uur": "'s middags", "20.00 uur": "'s avonds", "2.00 uur": "'s nachts" };
  for (const [word, time] of Object.entries(pairs)) {
    if (!(await page.getByRole("button", { name: word, exact: true }).isVisible())) continue;
    await page.getByRole("button", { name: word, exact: true }).click();
    await page.getByRole("button", { name: time, exact: true }).click();
  }
  await page.getByRole("button", { name: "Controleer" }).click();
  await page.keyboard.press("Enter"); // next
}

/** Play a lesson to its end screen: "Volgende →" on lessons, answer + check + next on exercises (Afronden on the last step). */
async function playToEnd(page: Page) {
  const done = page.getByRole("heading", { name: "Les klaar!" });
  for (let i = 0; i < 80 && !(await done.isVisible()); i++) {
    const next = page.getByRole("button", { name: /^(Volgende →|Afronden)/ });
    if (await next.isVisible()) await next.click({ timeout: 2000 }).catch(() => {}); // may vanish: Enter on the last answer already finished the lesson
    else if (await page.getByText(/Kies links een woord/).isVisible()) await matchPairs(page);
    else if (await page.getByRole("textbox").first().isVisible()) {
      for (const box of await page.getByRole("textbox").all()) await box.fill("x");
      await page.getByRole("button", { name: "Controleer" }).click();
      await page.keyboard.press("Enter"); // next
    } else await answerOne(page);
  }
  await expect(done).toBeVisible();
}

test("'Volgende les' after finishing a lesson starts the next lesson (not the old end screen)", async ({ page }) => {
  await startFresh(page);
  await page.goto("/unit/basis-tijd");
  await expect(page.getByText("1 / 31")).toBeVisible();
  await playToEnd(page);

  await page.getByRole("link", { name: /Volgende les/ }).click();
  await expect(page.getByRole("heading", { name: "Les klaar!" })).toHaveCount(0);
  await expect(page).not.toHaveURL(/basis-tijd$/);
  await expect(page.getByText(/^1 \/ \d+$/)).toBeVisible();
});

test("'Begin met leren' goes to the first unfinished lesson, then moves on to the next one once it is completed", async ({ page }) => {
  await startFresh(page);
  const start = page.getByRole("link", { name: /Begin met leren/ });
  await expect(start).toBeVisible();
  const first = await start.getAttribute("href");
  expect(first).toMatch(/^\/unit\//);
  await start.click();
  await expect(page).toHaveURL(new RegExp(`${first}$`));
  await playToEnd(page);

  await page.goto("/");
  const next = page.getByRole("link", { name: /Begin met leren/ });
  await expect(next).toBeVisible();
  expect(await next.getAttribute("href")).not.toBe(first);
});

test("the dashboard shows a background image that is visible once loaded", async ({ page }) => {
  await startFresh(page);
  const img = page.locator("img[aria-hidden], div[aria-hidden] > img").first();
  await expect(img).toHaveCSS("opacity", "1");
  expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
});

test("every screen opens without errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`${page.url()}: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${page.url()}: ${m.text()}`));
  await startFresh(page);
  for (const path of ["/", "/module/basis", "/module/exams", "/oefenen", "/woorden", "/woorden/herhalen", "/werkwoorden", "/schrijven/geschiedenis", "/samenvatting", "/examens", "/over", "/instellingen", "/welkom"]) {
    await page.goto(path);
    await expect(page.locator("main, #app").first()).not.toBeEmpty();
    await expect(page.getByText(/Er ging iets mis|Not found|404/i)).toHaveCount(0);
    await page.waitForTimeout(250);
    // Nothing may stick out past the side of a phone screen (a wide table once stretched the summary page)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${path} scrolls sideways`).toBeLessThanOrEqual(0);
  }
  expect(errors).toEqual([]);
});

test("holding a module card on a phone lets the same finger drag it to the top, and the order stays after a refresh", async ({ page }) => {
  await startFresh(page);
  const cards = page.locator("[data-module-id]");
  const titles = () => cards.locator("h3").allInnerTexts();
  const before = await titles();
  const last = cards.last();
  await last.scrollIntoViewIfNeeded();
  const from = (await last.boundingBox())!;
  // Real touch events (Playwright's touchscreen only taps): hold still, then drag up without lifting the finger.
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: string, x: number, y: number) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
  const x = from.x + from.width / 2;
  let y = from.y + from.height / 2;
  await touch("touchStart", x, y);
  await page.waitForTimeout(800);
  await expect(page.getByRole("button", { name: "Klaar" })).toBeVisible();
  // Up to the top edge of the screen and rest there: the page scrolls along until the card is first.
  while (y > 30) {
    y = Math.max(30, y - 20);
    await touch("touchMove", x, y);
  }
  await page.waitForTimeout(2500);
  await touch("touchMove", x, y + 1);
  await touch("touchEnd", x, y);
  const moved = [before.at(-1)!, ...before.slice(0, -1)];
  await expect.poll(titles).toEqual(moved);
  await page.reload();
  await expect.poll(titles).toEqual(moved);
});
