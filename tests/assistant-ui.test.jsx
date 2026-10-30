import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { it, expect, vi, afterEach } from "vitest";
import ResearchAssistant from "../src/ResearchAssistant.jsx";
import { liveFixture } from "./live-fixture.js";

afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });
const response = { status: "ready", summary: "Start with a site visit.", points: ["Customer demand is unknown."], nextSteps: ["Speak to customers."], trace: [{ action: "Inspect place", detail: "Fresh details returned." }], sources: [] };
it("sends result context and recent conversation on follow-ups and shows real actions", async () => {
  const result = liveFixture();
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => response })));
  render(<MemoryRouter><ResearchAssistant result={result} configured /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: /Which places should I visit/ }));
  await screen.findByText(response.summary);
  const payload = JSON.parse(fetch.mock.calls[0][1].body);
  expect(payload.result.id).toBe(result.id);
  fireEvent.change(screen.getByLabelText("Ask about this comparison"), { target: { value: "What should I ask the owner?" } });
  fireEvent.click(screen.getByRole("button", { name: "Ask assistant" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  expect(JSON.parse(fetch.mock.calls[1][1].body).history).toHaveLength(2);
  await waitFor(() => expect(screen.getAllByText("1 research actions")).toHaveLength(2));
});
it("keeps failed questions editable and recovers on retry", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ status: "unavailable", reason: "Quota reached" }) })
    .mockResolvedValueOnce({ ok: true, json: async () => response }));
  render(<MemoryRouter><ResearchAssistant result={liveFixture()} configured /></MemoryRouter>);
  const question = screen.getByLabelText("Ask about this comparison");
  fireEvent.change(question, { target: { value: "What remains unknown?" } });
  fireEvent.click(screen.getByRole("button", { name: "Ask assistant" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Quota reached");
  expect(question).toHaveValue("What remains unknown?");
  fireEvent.click(screen.getByRole("button", { name: "Ask assistant" }));
  await screen.findByText(response.summary);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
it("explains missing configuration without offering a broken composer", () => {
  render(<MemoryRouter><ResearchAssistant result={liveFixture()} configured={false} /></MemoryRouter>);
  expect(screen.getByRole("status")).toHaveTextContent("not configured");
  expect(screen.queryByRole("button", { name: "Ask assistant" })).not.toBeInTheDocument();
});
it("blocks a third question, preserves the limit after reopening, and gives a new exploration two questions", async () => {
  const result = liveFixture();
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => response })));
  const view = render(<MemoryRouter><ResearchAssistant result={result} configured /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: /Which places should I visit/ }));
  await screen.findByText(response.summary);
  fireEvent.change(screen.getByLabelText("Ask about this comparison"), { target: { value: "What remains unknown?" } });
  fireEvent.click(screen.getByRole("button", { name: "Ask assistant" }));
  await screen.findByText("0 of 2 questions left");
  await waitFor(() => expect(screen.getByRole("button", { name: "Ask assistant" })).toBeDisabled());
  expect(fetch).toHaveBeenCalledTimes(2);
  view.unmount();
  const reopened = render(<MemoryRouter><ResearchAssistant result={result} configured /></MemoryRouter>);
  expect(screen.getByLabelText("Ask about this comparison")).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: /Which places should I visit/ }));
  expect(fetch).toHaveBeenCalledTimes(2);
  reopened.unmount();
  render(<MemoryRouter><ResearchAssistant result={liveFixture()} configured /></MemoryRouter>);
  expect(screen.getByText("2 of 2 questions left")).toBeInTheDocument();
});
