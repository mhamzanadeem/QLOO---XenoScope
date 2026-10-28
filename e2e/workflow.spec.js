import { test, expect } from "@playwright/test";
import { liveFixture } from "../tests/live-fixture.js";
async function connected(page) {
  await page.route("**/api/config", (route) =>
    route.fulfill({ json: { liveConfigured: true } }),
  );
  await page.route("**/api/qloo/status", (route) =>
    route.fulfill({ json: { accessible: true } }),
  );
  await page.route("**/api/tags/search?*", (route) => {
    const q = new URL(route.request().url()).searchParams.get("q");
    return route.fulfill({
      json: {
        tags: [
          {
            id: `urn:tag:test:${q}`,
            name: q === "coffee" ? "Coffee" : "Books",
            category: "Test tag",
          },
        ],
      },
    });
  });
}
test("live workflow supports evidence, persistence and export", async ({
  page,
}) => {
  await connected(page);
  await page.route("**/api/compare", (route) =>
    route.fulfill({ json: liveFixture(route.request().postDataJSON()) }),
  );
  await page.goto("/build/market");
  await page.getByLabel("Cultural interest").fill("coffee");
  await page.getByRole("button", { name: /^Coffee / }).click();
  await page.getByRole("button", { name: "Run comparison" }).click();
  await expect(page.getByRole("heading", { name: "Compare what matters" })).toBeVisible();
  await page
    .getByRole("link", { name: "Local craftsmanship", exact: true })
    .click();
  await expect(page.getByText("Source ID: test:tag:craft")).toBeVisible();
  await page.getByRole("link", { name: "Back to comparison" }).click();
  await page.getByRole("button", { name: "Save exploration" }).click();
  await page
    .getByRole("link", { name: "Saved explorations", exact: true })
    .click();
  await page.reload();
  await page.getByRole("button", { name: "Reopen exploration" }).click();
  await page.getByRole("link", { name: "Export report", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("xenoscope-report.csv");
});
test("startup failure opens an accessible modal and retry restores connection", async ({
  page,
}) => {
  await connected(page);
  let failed = true;
  await page.route("**/api/qloo/status", (route) =>
    route.fulfill(
      failed
        ? {
            status: 503,
            json: { error: { message: "Qloo is temporarily unreachable." } },
          }
        : { json: { accessible: true } },
    ),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const dialog = page.getByRole("dialog", {
    name: "Qloo is currently unavailable",
  });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("temporarily unreachable");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  failed = false;
  await page.getByRole("button", { name: "Retry connection" }).click();
  await expect(dialog).not.toBeVisible();
});
test("comparison failure opens modal, preserves inputs and never offers demo fallback", async ({
  page,
}) => {
  await connected(page);
  let payload;
  await page.route("**/api/compare", (route) => {
    payload = route.request().postDataJSON();
    return route.fulfill({
      status: 429,
      json: {
        error: { message: "Qloo rate limit reached. Please retry later." },
      },
    });
  });
  await page.goto("/build/concept");
  await page.getByLabel("Interest for concept A").fill("coffee");
  await page.getByRole("button", { name: /^Coffee / }).click();
  await page.getByLabel("Interest for concept B").fill("books");
  await page.getByRole("button", { name: /^Books / }).click();
  await page.getByRole("button", { name: "Run comparison" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(payload.source).toBe("live");
  await expect(page.getByText("Use labeled demo")).toHaveCount(0);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByLabel("Shared location")).toHaveValue("Lahore");
  await expect(
    page.getByRole("button", { name: "Run comparison" }),
  ).toBeEnabled();
});
