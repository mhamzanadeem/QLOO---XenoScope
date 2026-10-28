import { it, expect, vi } from "vitest";
import { investorAdvice } from "../server/ai.js";
import { liveFixture } from "./live-fixture.js";
it("uses one bounded no-reasoning call, validates evidence, and reuses identical briefs", async () => {
  const result = liveFixture(); result.request.concept = "AI cache test";
  const id = result.candidates[0].entities[0].id;
  const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify({ headline: "Visit the returned examples", findings: [{ text: "Inspect this example before choosing a location.", evidenceIds: [id] }], risks: ["Demand is unverified"], nextSteps: ["Interview customers"] }) }] }], usage: { input_tokens: 400, output_tokens: 100 } }) }));
  const env = { OPENAI_API_KEY: "test" };
  const first = await investorAdvice(result, { env, fetcher });
  expect(first.status).toBe("ready");
  const request = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(request.reasoning.effort).toBe("none"); expect(request.max_output_tokens).toBe(700); expect(request.store).toBe(false);
  expect(request.tools).toBeUndefined();
  expect((await investorAdvice(result, { env, fetcher })).cached).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("rejects invented citations and preserves fallback without retries", async () => {
  const result = liveFixture(); result.request.concept = "Invalid citation test";
  const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify({ headline: "Research", findings: [{ text: "Claim", evidenceIds: ["invented"] }], risks: [], nextSteps: [] }) }] }] }) }));
  expect((await investorAdvice(result, { env: { OPENAI_API_KEY: "test" }, fetcher })).status).toBe("unavailable");
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect((await investorAdvice(result, { env: {}, fetcher })).status).toBe("not-configured");
});
