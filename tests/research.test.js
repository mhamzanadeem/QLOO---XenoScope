import { it, expect, vi, afterEach } from "vitest";
import { requestSchema, resultSchema } from "../shared/schema.js";
import { researchComparison } from "../server/research.js";
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const request = { mode: "market", source: "live", concept: "Coffee", tagId: "urn:tag:coffee", candidates: [{ label: "Lahore" }, { label: "Islamabad" }] };
it("rejects identical venue IDs under different labels", () => {
  expect(requestSchema.safeParse({ ...request, mode: "venue", candidates: [{ label: "First", entityId: "11111111-1111-4111-8111-111111111111" }, { label: "Second", entityId: "11111111-1111-4111-8111-111111111111" }] }).success).toBe(false);
});
it("investigates sparse coverage within three API calls and preserves the question", async () => {
  vi.stubEnv("QLOO_API_KEY", "test");
  const fetcher = vi.fn(async url => ({ ok: true, json: async () => String(url).includes("/v2/tags") ? { results: { tags: [{ id: "urn:tag:alternative", name: "Alternative" }] } } : { results: { entities: [] } } }));
  vi.stubGlobal("fetch", fetcher);
  const result = resultSchema.parse(await researchComparison(request));
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(result.request).toEqual(request);
  expect(result.research.status).toBe("limited-evidence");
  expect(result.research.alternatives[0].name).toBe("Alternative");
});
