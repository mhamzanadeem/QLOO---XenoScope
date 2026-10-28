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
    screen.getByRole("heading", { name: /Compare markets/ }),
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
  fireEvent.change(screen.getByLabelText("Verified cultural tag"), {
    target: { value: "coffee" },
  });
  fireEvent.click(
    await screen.findByRole("button", { name: "Coffee Place tag" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Run comparison" }));
  await screen.findByText("Where the patterns diverge");
  expect(screen.getByText(/4 shared tags/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Filter signals"), {
    target: { value: "nonexistent" },
  });
  expect(
    screen.getByText(/No tags match these filters. Reset/),
  ).toBeInTheDocument();
});

it("shows the research brief and activity after an investigation", async () => {
  mockApi();
  const original = fetch;
  vi.stubGlobal("fetch", vi.fn(async (url, opts) => {
    if (url !== "/api/research") return original(url, opts);
    return { ok: true, json: async () => ({ ...liveFixture(JSON.parse(opts.body)), research: { nextStep: "Interview five customers.", evidence: [], trace: [{ action: "Assess coverage", detail: "Limited metadata." }], alternatives: [], caveat: "Not market demand." } }) };
  }));
  render(<MemoryRouter initialEntries={["/build/market"]}><App /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText("Verified cultural tag"), { target: { value: "coffee" } });
  fireEvent.click(await screen.findByRole("button", { name: "Coffee Place tag" }));
  fireEvent.click(screen.getByLabelText("Investigate coverage and suggest a next step"));
  fireEvent.click(screen.getByRole("button", { name: "Run comparison" }));
  expect(await screen.findByText("Interview five customers.")).toBeInTheDocument();
  expect(screen.getByText("Research activity")).toBeInTheDocument();
});
