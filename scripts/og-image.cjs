// Renders site/og-image.html to public/og-image.png (1200×630), the picture shown when the site is shared.
const { chromium } = require("playwright");
const path = require("node:path");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto("file://" + path.resolve(__dirname, "../site/og-image.html"));
  await page.screenshot({ path: path.resolve(__dirname, "../public/og-image.png") });
  await browser.close();
})();
