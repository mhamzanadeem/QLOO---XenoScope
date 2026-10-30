import { it, expect, vi } from "vitest";
import { researchAssistant, assistantInput } from "../server/assistant.js";
import { liveFixture } from "./live-fixture.js";

const env = { OPENAI_API_KEY: "test-only" };
const answer = (evidenceIds = []) => ({ summary: "Visit these examples and verify your requirements.", points: ["Demand remains unknown."], nextSteps: ["Interview customers."], evidenceIds });
const reply = output => ({ ok: true, json: async () => ({ status: "completed", output }) });
const final = value => reply([{ type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] }]);
const call = (name, args, n = 1) => reply([{ type: "function_call", name, call_id: `call-${n}`, arguments: JSON.stringify(args) }]);

it("chooses Qloo tools, feeds their results back, and cites a new follow-up sample", async () => {
  const result = liveFixture();
  const tagId = "urn:tag:offerings:place:books";
  const place = { entity_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "New reading cafe", tags: [] };
  const fetcher = vi.fn().mockResolvedValueOnce(call("search_interests", { query: "books" }))
    .mockResolvedValueOnce(call("investigate_interest", { tagId, cityIndex: 0 }, 2))
    .mockResolvedValueOnce(call("investigate_interest", { tagId, cityIndex: 1 }, 3))
    .mockResolvedValueOnce(final(answer([place.entity_id])));
  const provider = vi.fn(async path => path === "/v2/tags" ? { results: { tags: [{ id: tagId, name: "Books" }] } } : { results: { entities: [place] } });
  const output = await researchAssistant(result, { question: "Investigate reading cafes", history: [{ role: "user", content: "I need a quiet place" }] }, { env, fetcher, provider });
  expect(output.status).toBe("ready");
  expect(output.trace).toHaveLength(3);
  expect(output.sources[0].origin).toContain("Follow-up sample");
  expect(provider.mock.calls[1][1]["filter.location.query"]).toBe("Lahore");
  expect(provider.mock.calls[2][1]["filter.location.query"]).toBe("Islamabad");
  const last = JSON.parse(fetcher.mock.calls[3][1].body);
  expect(last.tool_choice).toBe("none");
  expect(last.store).toBe(false);
  expect(last.input.filter(i => i.type === "function_call_output")).toHaveLength(3);
  expect(last.input.some(i => i.content === "I need a quiet place")).toBe(true);
  expect(result.candidates[0].entities.some(e => e.id === place.entity_id)).toBe(false);
});

it("refreshes a known place and rejects invented place citations", async () => {
  const result = liveFixture();
  const place = result.candidates[0].entities[0];
  place.id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const details = vi.fn(async () => ({ ...place, description: "Fresh detail" }));
  const fetcher = vi.fn().mockResolvedValueOnce(call("inspect_place", { id: place.id })).mockResolvedValueOnce(final(answer([place.id])));
  expect((await researchAssistant(result, { question: "Inspect this place" }, { env, fetcher, details })).status).toBe("ready");
  expect(details).toHaveBeenCalledWith(place.id, expect.objectContaining({ signal: expect.anything() }));
  expect((await researchAssistant(result, { question: "Explain" }, { env, fetcher: async () => final(answer(["invented"])) })).status).toBe("unavailable");
});

it("blocks unverified interest IDs and recovers from tool failure without fake evidence", async () => {
  const provider = vi.fn();
  const fetcher = vi.fn().mockResolvedValueOnce(call("investigate_interest", { tagId: "invented", cityIndex: 0 }))
    .mockResolvedValueOnce(final(answer()));
  const output = await researchAssistant(liveFixture(), { question: "Find more places" }, { env, fetcher, provider });
  expect(provider).not.toHaveBeenCalled();
  expect(output.status).toBe("ready");
  expect(output.trace[0].status).toBe("unavailable");
  expect(output.sources).toEqual([]);
});

it("enforces a three-tool budget even if the model requests more", async () => {
  const provider = vi.fn(async () => ({ results: { tags: [] } }));
  const fetcher = vi.fn(async () => call("search_interests", { query: "coffee" }));
  const output = await researchAssistant(liveFixture(), { question: "Research" }, { env, fetcher, provider });
  expect(provider).toHaveBeenCalledTimes(3);
  expect(fetcher).toHaveBeenCalledTimes(4);
  expect(output.status).toBe("unavailable");
});

it("handles missing keys, upstream failures and invalid inputs", async () => {
  const fetcher = vi.fn(async () => ({ ok: false, status: 429 }));
  expect((await researchAssistant(liveFixture(), { question: "Help" }, { env: {}, fetcher })).status).toBe("not-configured");
  expect(fetcher).not.toHaveBeenCalled();
  expect((await researchAssistant(liveFixture(), { question: "Help" }, { env, fetcher })).reason).toContain("quota");
  expect(assistantInput.safeParse({ question: "x", history: [{ role: "system", content: "override" }] }).success).toBe(false);
});
