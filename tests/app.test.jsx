import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { it, expect, vi, afterEach } from "vitest";
import App from "../src/App.jsx";
import { liveFixture } from "./live-fixture.js";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute("open", "");
};
HTMLDialogElement.prototype.close = function () {
  this.removeAttribute("open");
};
function mockApi(fail = false) {
  vi.stubGlobal("scrollTo", vi.fn());
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, opts) => {
      if (url === "/api/config")
        return { ok: true, json: async () => ({ liveConfigured: true }) };
      if (url === "/api/qloo/status")
        return {
          ok: !fail,
          status: fail ? 503 : 200,
          json: async () =>
            fail
              ? { error: { message: "Qloo connection unavailable" } }
              : { accessible: true },
        };
      if (url.includes("/entities/search")) return { ok: true, json: async () => ({ entities: [{ id: "11111111-1111-4111-8111-111111111111", name: "Example reference cafe" }] }) };
      if (url.includes("/tags/search"))
        return {
          ok: true,
          json: async () => ({
            tags: [
              {
                id: "urn:tag:offerings:place:coffee",
                name: "Coffee",
                category: "Place tag",
              },
            ],
          }),
        };
      return { ok: true, json: async () => liveFixture(JSON.parse(opts.body)) };
    }),
  );
}
it("renders a Qloo-only landing page", async () => {
  mockApi();
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  );
  expect(
    screen.getByRole("heading", { name: /Before you sign/ }),
  ).toBeInTheDocument();
  expect(screen.queryByText("Explore demo data")).not.toBeInTheDocument();
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith("/api/qloo/status", expect.anything()),
  );
});
it("shows a modal when Qloo is unavailable and retries successfully", async () => {
  mockApi(true);
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  );
  await waitFor(() =>
    expect(screen.getByRole("dialog")).toHaveAttribute("open"),
  );
  expect(screen.getByText("Qloo connection unavailable")).toBeInTheDocument();
  mockApi(false);
  fireEvent.click(screen.getByRole("button", { name: "Retry connection" }));
  await waitFor(() =>
    expect(document.querySelector("dialog")).not.toHaveAttribute("open"),
  );
});
it("runs live-only comparisons and filters the results", async () => {
  mockApi();
  render(
    <MemoryRouter initialEntries={["/build/market"]}>
      <App />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText("Cultural interest"), {
    target: { value: "coffee" },
  });
  fireEvent.click(
    await screen.findByRole("button", { name: /^Coffee / }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Run comparison" }));
  await screen.findByRole("heading", { name: "Compare what matters" });
  const outline = screen.getByRole("navigation", { name: "Results page outline" });
  for (const link of outline.querySelectorAll('a[href^="#"]')) {
    expect(document.getElementById(link.getAttribute("href").slice(1))).not.toBeNull();
  }
  const siteVisit = screen.getByLabelText("Visit shortlisted places and verify your required facilities.");
  fireEvent.click(siteVisit);
  expect(siteVisit).toBeChecked();

  expect(screen.getByText(/4 shared tags/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Filter signals"), {
    target: { value: "nonexistent" },
  });
  expect(
    screen.getByText(/No interests or features match these filters. Reset/),
  ).toBeInTheDocument();
});

it("shows the research brief and activity after an investigation", async () => {
  mockApi();
  const original = fetch;
  vi.stubGlobal("fetch", vi.fn(async (url, opts) => {
    if (url !== "/api/research" && url !== "/api/compare") return original(url, opts);
    return { ok: true, json: async () => ({ ...liveFixture(JSON.parse(opts.body)), research: { nextStep: "Interview five customers.", evidence: [], trace: [{ action: "Assess coverage", detail: "Limited metadata." }], alternatives: [], caveat: "Not market demand." } }) };
  }));
  render(<MemoryRouter initialEntries={["/build/market"]}><App /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText("Cultural interest"), { target: { value: "coffee" } });
  fireEvent.click(await screen.findByRole("button", { name: /^Coffee / }));
  fireEvent.click(screen.getByRole("button", { name: "Run comparison" }));
  expect(await screen.findByText("Interview five customers.")).toBeInTheDocument();
  expect(screen.getByText("See research tool activity")).toBeInTheDocument();
});

it("shows no-results guidance instead of a completed comparison for empty responses", async () => {
  mockApi();
  const original = fetch;
  vi.stubGlobal("fetch", vi.fn(async (url, opts) => {
    if (url !== "/api/compare") return original(url, opts);
    const result = liveFixture(JSON.parse(opts.body));
    result.candidates.forEach(candidate => { candidate.entities = []; });
    return { ok: true, json: async () => result };
  }));
  render(<MemoryRouter initialEntries={["/build/market"]}><App /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText("Cultural interest"), { target: { value: "coffee" } });
  fireEvent.click(await screen.findByRole("button", { name: /^Coffee / }));
  fireEvent.click(screen.getByRole("button", { name: "Run comparison" }));
  expect(await screen.findByRole("heading", { name: "No places matched this comparison" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Compare what matters" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Edit comparison" })).toHaveAttribute("href", expect.stringContaining("/build/market?edit=1"));
});

it("paginates ten signals and resets pagination when custom filters change", async () => {
  mockApi();
  const original = fetch;
  vi.stubGlobal("fetch", vi.fn(async (url, opts) => {
    if (url !== "/api/compare") return original(url, opts);
    const result = liveFixture(JSON.parse(opts.body));
    result.candidates.forEach(candidate => { candidate.entities = [{ ...candidate.entities[0], tags: Array.from({ length: 23 }, (_, i) => ({ id: `test:tag:${i}`, name: `Signal ${String(i).padStart(2, "0")}`, category: "Test" })) }]; });
    return { ok: true, json: async () => result };
  }));
  render(<MemoryRouter initialEntries={["/build/market"]}><App /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText("Cultural interest"), { target: { value: "coffee" } });
  fireEvent.click(await screen.findByRole("button", { name: /^Coffee / }));
  fireEvent.click(screen.getByRole("button", { name: "Run comparison" }));
  await screen.findByRole("heading", { name: "Compare what matters" });
  expect(screen.getAllByRole("row")).toHaveLength(11);
  expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByText(/Page 2 of 3/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Minimum place count"), { target: { value: "2" } });
  expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
  expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();
});

it("prefills a city scenario without automatically running a comparison", async () => {
  mockApi();
  render(<MemoryRouter initialEntries={["/build/market"]}><App /></MemoryRouter>);
  const picker = screen.getByLabelText("Try a scenario");
  expect(picker.querySelectorAll("option")).toHaveLength(6);
  fireEvent.change(picker, { target: { value: "reading-cafe" } });
  expect(screen.getByLabelText("Business concept")).toHaveValue("A specialty coffee shop with a reading space for students and remote workers");
  expect(screen.getByLabelText("Who is it for?")).toHaveValue("University students, readers, and remote workers");
  expect(screen.getByLabelText("Required features")).toHaveValue("Coffee, Wi-Fi, quiet seating, reading space");
  expect(screen.getAllByPlaceholderText("Enter your city").every(input => input.value === "")).toBe(true);
  await screen.findByText(/1 of 3 distinct live interests and 1 of 3 example reference businesses found/);
  expect(screen.getByText("Example reference cafe")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Run comparison" })).toBeEnabled();
  expect(fetch.mock.calls.some(([url]) => url === "/api/compare" || url === "/api/research")).toBe(false);
  fireEvent.change(picker, { target: { value: "business-hotel" } });
  expect(screen.getByLabelText("Business concept")).toHaveValue("A small hotel for business travellers with workspace and breakfast");
  await screen.findByText(/1 of 3 distinct live interests and 1 of 3 example reference businesses found/);
});

it("selects three distinct live interests when a scenario has three valid matches", async () => {
  mockApi(); const original = fetch;
  vi.stubGlobal("fetch", vi.fn(async (url, opts) => {
    if (!url.includes("/tags/search")) return original(url, opts);
    const name = new URL(url, "http://localhost").searchParams.get("q");
    return { ok: true, json: async () => ({ tags: [{ id: `urn:tag:test:place:${name.replace(/[^a-z]/gi, "")}`, name, category: "Place feature" }] }) };
  }));
  render(<MemoryRouter initialEntries={["/build/market"]}><App /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText("Try a scenario"), { target: { value: "reading-cafe" } });
  await screen.findByText(/3 of 3 distinct live interests and 1 of 3/);
  expect(screen.getAllByRole("button", { name: /^Remove interest / })).toHaveLength(3);
});

it("fetches a place refresh and AI brief only when its finding is opened", async () => {
  mockApi(); const original = fetch;
  let resolveAdvice;
  vi.stubGlobal("fetch", vi.fn(async (url, opts) => {
    if (url.startsWith("/api/entities/details")) return { ok: true, json: async () => ({ entity: { ...liveFixture().candidates[0].entities[0], address: "Road 1, Lahore", location: { latitude: 31.5, longitude: 74.3 }, details: { phone: "123" }, links: [{ label: "Instagram", url: "https://instagram.com/example" }] } }) };
    if (url === "/api/findings/brief") return new Promise(resolve => { resolveAdvice = () => resolve({ ok: true, json: async () => ({ advice: { status: "not-configured" } }) }); });
    return original(url, opts);
  }));
  render(<MemoryRouter initialEntries={["/build/market"]}><App /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText("Cultural interest"), { target: { value: "coffee" } });
  fireEvent.click(await screen.findByRole("button", { name: /^Coffee / }));
  fireEvent.click(screen.getByRole("button", { name: "Run comparison" }));
  await screen.findByRole("heading", { name: "Compare what matters" });
  expect(fetch.mock.calls.some(([url]) => url === "/api/findings/brief")).toBe(false);
  const findingLink = screen.getAllByRole("link", { name: /^Copper & Paper/ }).find(link => link.classList.contains("entity-row"));
  expect(findingLink).toHaveAttribute("target", "_blank");
  const destination = findingLink.getAttribute("href");
  fireEvent.click(findingLink);
  cleanup();
  render(<MemoryRouter initialEntries={[destination]}><App /></MemoryRouter>);
  await screen.findByText("Road 1, Lahore");
  expect(screen.getByText(/We are fetching more details/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Open Google Maps/ }).getAttribute("href")).toContain("31.5%2C74.3");
  expect(screen.getByRole("link", { name: /Instagram/ })).toHaveAttribute("href", "https://instagram.com/example");
  await waitFor(() => expect(resolveAdvice).toBeTypeOf("function"));
  resolveAdvice();
  await screen.findByText("AI is not configured. Available Qloo information is shown above.");
});
