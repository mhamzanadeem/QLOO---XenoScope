import { test, expect } from "@playwright/test";
import { liveFixture } from "../tests/live-fixture.js";
async function openLink(page, locator) {
  const opened = page.waitForEvent("popup");
  await locator.click();
  const tab = await opened;
  await tab.waitForLoadState();
  return tab;
}
async function connected(page) {
  await page.context().route("**/api/config", (route) =>
    route.fulfill({ json: { liveConfigured: true } }),
  );
  await page.context().route("**/api/qloo/status", (route) =>
    route.fulfill({ json: { accessible: true } }),
  );
  await page.context().route("**/api/tags/search?*", (route) => {
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
  await page.context().route("**/api/compare", (route) =>
    route.fulfill({ json: liveFixture(route.request().postDataJSON()) }),
  );
  await page.goto("/build/market");
  await page.getByLabel("Cultural interest").fill("coffee");
  await page.getByRole("button", { name: /^Coffee / }).click();
  await page.getByRole("button", { name: "Run comparison" }).click();
  await expect(page.getByRole("heading", { name: "Compare what matters" })).toBeVisible();
  expect(await page.locator('a[href]:not([href^="#"])').evaluateAll(links => links.every(link => link.target === "_blank"))).toBe(true);
  const finding = await openLink(page, page.getByRole("link", { name: "Local craftsmanship", exact: true }));
  await finding.getByText("Technical source details", { exact: true }).click();
  await expect(finding.getByText("Source ID: test:tag:craft")).toBeVisible();
  expect(page.isClosed()).toBe(false);
  await finding.reload();
  await expect(finding.getByRole("heading", { name: "Local craftsmanship" })).toBeVisible();
  await finding.close();
  await page.getByRole("button", { name: "Save exploration" }).click();
  page = await openLink(page, page.getByRole("link", { name: "Saved explorations", exact: true }));
  await page.reload();
  await page.getByRole("button", { name: "Reopen exploration" }).click();
  page = await openLink(page, page.getByRole("link", { name: "Export report", exact: true }));
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("xenoscope-report.csv");
});

test("start exploring opens cities directly and results assistant keeps follow-up context", async ({ page }) => {
  await connected(page);
  await page.context().route("**/api/config", route => route.fulfill({ json: { liveConfigured: true, assistantConfigured: true } }));
  await page.context().route("**/api/compare", route => route.fulfill({ json: liveFixture(route.request().postDataJSON()) }));
  const questions = [];
  await page.context().route("**/api/assistant", route => {
    questions.push(route.request().postDataJSON());
    return route.fulfill({ json: { status: "ready", summary: "Visit the documented examples before committing.", points: ["Customer demand needs local validation."], nextSteps: ["Interview five prospective customers."],
      sources: [], trace: [{ action: "Search interests", detail: "Reading: 2 interests returned", status: "complete" }] } });
  });
  await page.goto("/");
  page = await openLink(page, page.getByRole("link", { name: "Start exploring", exact: true }));
  await expect(page).toHaveURL(/\/build\/market$/);
  await page.goto("/explore");
  await expect(page).toHaveURL(/\/build\/market$/);
  await page.getByLabel("Cultural interest").fill("coffee");
  await page.getByRole("button", { name: /^Coffee / }).click();
  await page.getByRole("button", { name: "Run comparison" }).click();
  await expect(page.getByRole("heading", { name: "Your next move" })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "test-results/results-desktop.png", fullPage: false });
  await page.getByRole("button", { name: /Which places should I visit first/ }).click();
  await expect(page.getByText("Visit the documented examples before committing.")).toBeVisible();
  await page.getByText("1 research actions", { exact: true }).click();
  await expect(page.getByText("Reading: 2 interests returned")).toBeVisible();
  await page.getByLabel("Ask about this comparison").fill("What should I verify next?");
  await page.getByRole("button", { name: "Ask assistant" }).click();
  await expect(page.getByText("Visit the documented examples before committing.")).toHaveCount(2);
  expect(questions[1].history).toHaveLength(2);
  expect(questions[1].result.candidates).toHaveLength(2);
  await expect(page.getByRole("button", { name: "Ask assistant" })).toBeDisabled();
  await expect(page.getByText("0 of 2 questions left")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#decision").evaluate(element => element.scrollIntoView({ block: "start" }));
  await page.screenshot({ path: "test-results/results-mobile.png" });
  await page.locator("#research-assistant").evaluate(element => element.scrollIntoView({ block: "start" }));
  await page.screenshot({ path: "test-results/assistant-mobile.png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(questions).toHaveLength(2);
});
test("assistant and visit brief recover from service errors without losing results", async ({ page }) => {
  await connected(page);
  await page.context().route("**/api/compare", route => route.fulfill({ json: liveFixture(route.request().postDataJSON()) }));
  let attempts = 0;
  await page.context().route("**/api/assistant", route => ++attempts === 1
    ? route.fulfill({ status: 504, contentType: "text/html", body: "Gateway Timeout" })
    : route.fulfill({ json: { status: "ready", summary: "Verify your requirements during a site visit.", points: [], nextSteps: [], sources: [], trace: [] } }));
  const place = liveFixture().candidates[0].entities[0];
  await page.context().route("**/api/entities/details?*", route => route.fulfill({ json: { entity: { ...place, details: { raw: "x".repeat(100000) } } } }));
  let briefs = 0;
  await page.context().route("**/api/findings/brief", route => {
    expect(route.request().postDataJSON().result.candidates[0].entities[0].details).toBeUndefined();
    return route.fulfill({ json: { advice: ++briefs === 1 ? { status: "unavailable", reason: "OpenAI temporarily unavailable." } : { status: "ready", headline: "Check the documented facilities.", findings: [], nextSteps: [] } } });
  });
  await page.goto("/build/market");
  await page.getByLabel("Cultural interest").fill("coffee");
  await page.getByRole("button", { name: /^Coffee / }).click();
  await page.getByRole("button", { name: "Run comparison" }).click();
  await page.getByRole("button", { name: "What is still unknown about my requirements?" }).click();
  await expect(page.getByRole("alert")).toContainText("timed out");
  await expect(page.getByLabel("Ask about this comparison")).toHaveValue("What is still unknown about my requirements?");
  await page.getByRole("button", { name: "Ask assistant" }).click();
  await expect(page.getByText("Verify your requirements during a site visit.")).toBeVisible();
  const finding = await openLink(page, page.locator(".entity-row").first());
  await finding.getByRole("button", { name: "Retry visit brief" }).click();
  await expect(finding.getByText("Check the documented facilities.")).toBeVisible();
  expect(page.isClosed()).toBe(false);
});

test("startup failure opens an accessible modal and retry restores connection", async ({
  page,
}) => {
  await connected(page);
  let failed = true;
  await page.context().route("**/api/qloo/status", (route) =>
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
  await page.context().route("**/api/compare", (route) => {
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
