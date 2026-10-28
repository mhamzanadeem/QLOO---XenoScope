import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:5173/");
await page.evaluate(() => document.fonts.ready);
await page.screenshot({
  path: "test-results/landing-desktop.png",
  fullPage: true,
});
await page.goto("http://127.0.0.1:5173/build/market");
await page.getByLabel("Verified cultural tag").fill("coffee");
await page.getByRole("button", { name: /^Coffee/ }).first().click();
await page.getByRole("button", { name: "Run comparison" }).click();
await page.getByText("Where the patterns diverge").waitFor();
await page.waitForTimeout(800);
await page.screenshot({
  path: "test-results/results-desktop.png",
  fullPage: true,
});
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({
  path: "test-results/results-mobile.png",
  fullPage: true,
});
console.log(
  JSON.stringify({
    errors,
    desktopScreenshot: "test-results/results-desktop.png",
    mobileOverflow: await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      viewport: innerWidth,
    })),
  }),
);
await browser.close();
