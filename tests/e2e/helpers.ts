import { expect, type Page } from "@playwright/test";

/** First visit: the welcome screen shows once; start the course. */
export async function startFresh(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Welkom bij Inburgering A2" })).toBeVisible();
  await page.getByRole("button", { name: /Begin met leren/ }).first().click();
  await expect(page.getByRole("heading", { name: /Welkom terug/ })).toBeVisible();
}

/** Answer the current exercise (option 1, check, next). */
export async function answerOne(page: Page) {
  await page.keyboard.press("1");
  await page.keyboard.press("Enter"); // check
  await expect(page.getByRole("status").filter({ hasText: /Goed zo|Helemaal goed|Prima|Bijna|Niet helemaal/ })).toBeVisible();
  await page.keyboard.press("Enter"); // next
}

/** Opens the hamburger menu (the phone layout). */
export async function openMenu(page: Page) {
  await page.getByRole("button", { name: "Menu openen" }).click();
  await expect(page.getByRole("navigation", { name: "Hoofdmenu" }).last()).toBeVisible();
}
