import { it, expect, vi, afterEach } from "vitest";
import { openAIResponse } from "../server/openai.js";
import { investorAdvice } from "../server/ai.js";
import { requestAI, compactAIResult } from "../src/aiRequest.js";
import { liveFixture } from "./live-fixture.js";

afterEach(() => vi.unstubAllGlobals());
it("distinguishes DNS, timeout, credentials, unavailable model and truncated output", async () => {
  const cases = [
    [async () => { throw Object.assign(new Error(), { cause: { code: "ENOTFOUND" } }); }, "AI_DNS"],
    [async () => { throw new DOMException("", "TimeoutError"); }, "AI_TIMEOUT"],
    [async () => ({ ok: false, status: 401, json: async () => ({}) }), "AI_ACCESS"],
    [async () => ({ ok: false, status: 400, json: async () => ({ error: { code: "model_not_found" } }) }), "AI_MODEL"],
    [async () => ({ ok: true, json: async () => ({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }) }), "AI_INCOMPLETE"],
  ];
  for (const [fetcher, code] of cases) await expect(openAIResponse({}, { env: {}, fetcher })).rejects.toMatchObject({ code });
});
it("returns a specific visit-brief failure and uses identical provider/client schema limits", async () => {
  const result = liveFixture(); result.request.concept = "Diagnostic test";
  const fetcher = vi.fn(async () => { throw Object.assign(new Error(), { cause: { code: "ENOTFOUND" } }); });
  const output = await investorAdvice(result, { env: { OPENAI_API_KEY: "test" }, fetcher });
  expect(output.code).toBe("AI_DNS");
  expect(output.reason).toContain("hostname");
  const schema = JSON.parse(fetcher.mock.calls[0][1].body).text.format.schema;
  expect(schema.properties.headline.maxLength).toBe(600);
  expect(schema.properties.findings.maxItems).toBe(4);
});
it("removes bulky provider metadata without losing requirement tags or original data", () => {
  const result = liveFixture(); result.candidates[0].entities[0].details = { raw: "x".repeat(100000) };
  const compact = compactAIResult(result);
  expect(JSON.stringify(compact).length).toBeLessThan(JSON.stringify(result).length / 2);
  expect(compact.candidates[0].entities[0].tags).toEqual(result.candidates[0].entities[0].tags);
  expect(result.candidates[0].entities[0].details.raw).toHaveLength(100000);
});
it("handles browser fetch failures and non-JSON platform errors without raw failed-to-fetch messages", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
  await expect(requestAI("/assistant", {})).rejects.toThrow("Could not reach the research service");
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 504, json: async () => { throw new SyntaxError(); } })));
  await expect(requestAI("/assistant", {})).rejects.toThrow("timed out");
});
