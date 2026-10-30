import { it, expect, vi, afterEach } from "vitest";
import {
  qloo,
  readEntities,
  upstreamError,
  liveComparison,
} from "../server/qloo.js";
import { handleRequest } from "../server/router.js";
import { liveFixture } from "./live-fixture.js";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
async function call(url, method = "GET", body) {
  let output;
  const headers = {};
  const res = {
    setHeader: (k, v) => (headers[k] = v),
    end: (v) => {
      output = v;
    },
  };
  await handleRequest(
    {
      url,
      method,
      body,
      headers: { "content-type": "application/json" },
      socket: { remoteAddress: "test" },
    },
    res,
  );
  return { status: res.statusCode, headers, data: JSON.parse(output) };
}
it("validates assistant context and reports missing configuration without provider calls", async () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  expect((await call("/api/assistant", "POST", { question: "Explain this", result: {} })).status).toBe(400);
  const output = await call("/api/assistant", "POST", { question: "Explain this", result: liveFixture() });
  expect(output.status).toBe(200);
  expect(output.data.status).toBe("not-configured");
  expect((await call("/api/assistant")).status).toBe(405);
});
it("returns a friendly error when the key is missing", async () => {
  await expect(qloo("/search", {}, { env: {} })).rejects.toMatchObject({
    status: 503,
    code: "NOT_CONFIGURED",
  });
});
it("normalizes auth, rate limit, network, timeout and malformed failures", async () => {
  expect(upstreamError(429).status).toBe(429);
  expect(upstreamError(401).message).not.toContain("secret");
  const opts = {
    env: { QLOO_API_KEY: "test-only" },
    fetcher: vi
      .fn()
      .mockRejectedValue(new DOMException("timeout", "TimeoutError")),
  };
  await expect(qloo("/search", {}, opts)).rejects.toMatchObject({
    status: 504,
  });
  await expect(
    qloo(
      "/search",
      {},
      {
        ...opts,
        fetcher: async () => ({
          ok: true,
          json: async () => {
            throw Error();
          },
        }),
      },
    ),
  ).rejects.toMatchObject({ code: "MALFORMED_RESPONSE" });
  expect(() => readEntities({ results: { wrong: [] } })).toThrow("unsupported");
});
it("uses documented paths and a server authentication header", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ results: [] }) });
  await qloo(
    "/search",
    { query: "coffee" },
    { env: { QLOO_API_KEY: "test-only" }, fetcher },
  );
  expect(fetcher.mock.calls[0][0].pathname).toBe("/search");
  expect(fetcher.mock.calls[0][1].headers["X-Api-Key"]).toBe("test-only");
});
it("rejects an arbitrary upstream host", async () => {
  await expect(
    qloo(
      "/search",
      {},
      { env: { QLOO_API_KEY: "test", QLOO_BASE_URL: "https://example.com" } },
    ),
  ).rejects.toMatchObject({ code: "INVALID_CONFIG" });
});
it("exposes safe config and validates API input", async () => {
  vi.stubEnv("QLOO_API_KEY", "");
  expect((await call("/api/config")).data).toEqual(
    expect.objectContaining({ liveConfigured: false }),
  );
  expect((await call("/api/compare", "POST", {})).status).toBe(400);
  expect((await call("/api/qloo/status")).status).toBe(503);
  expect((await call("/api/health", "POST", {})).status).toBe(405);
});
it("rejects demo requests permanently", async () => {
  const response = await call("/api/compare", "POST", { source: "demo" });
  expect(response.status).toBe(400);
  expect(response.data.error.code).toBe("LIVE_ONLY");
  expect((await call("/api/report", "POST", { result: {} })).status).toBe(400);
});

it("routes Vercel rewritten paths to the shared handler", async () => {
  expect((await call("/api?route=health")).data.status).toBe("ok");
});
it("retrieves and preserves separate live query evidence in all modes", async () => {
  vi.stubEnv("QLOO_API_KEY", "test-only");
  const fetcher = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      results: {
        entities: [
          {
            entity_id: "a90e6260-9f61-4dfc-8b37-6527cccddf49",
            name: "Mocked place",
            tags: [{ id: "urn:tag:test:coffee", name: "Coffee" }],
          },
        ],
      },
    }),
  }));
  vi.stubGlobal("fetch", fetcher);
  const base = {
    source: "live",
    concept: "Research question",
    mode: "market",
    tagId: "urn:tag:test:coffee",
    candidates: [{ label: "Lahore" }, { label: "Islamabad" }],
  };
  const result = await liveComparison(base);
  expect(result.source).toBe("live");
  expect(result.candidates.every((c) => !c.provenance.illustrative)).toBe(true);
  expect(fetcher.mock.calls[0][0].searchParams.get("filter.location.query")).toBe(
    "Lahore",
  );
  fetcher.mockClear();
  await liveComparison({
    ...base,
    mode: "venue",
    candidates: [
      { label: "Venue A", entityId: "a90e6260-9f61-4dfc-8b37-6527cccddf49" },
      { label: "Venue B", entityId: "b90e6260-9f61-4dfc-8b37-6527cccddf49" },
    ],
  });
  expect(
    fetcher.mock.calls[1][0].searchParams.get("signal.interests.entities"),
  ).toBe("b90e6260-9f61-4dfc-8b37-6527cccddf49");
  fetcher.mockClear();
  await liveComparison({
    ...base,
    mode: "concept",
    location: "Lahore",
    candidates: [
      { label: "Coffee", tagId: "urn:tag:test:coffee" },
      { label: "Books", tagId: "urn:tag:test:books" },
    ],
  });
  expect(fetcher.mock.calls[1][0].searchParams.get("filter.tags")).toBe(
    "urn:tag:test:books",
  );
  expect(fetcher.mock.calls[1][0].searchParams.get("filter.location.query")).toBe(
    "Lahore",
  );
});
it("does not substitute demo data when live requests fail", async () => {
  vi.stubEnv("QLOO_API_KEY", "test-only");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: false, status: 429 })),
  );
  const response = await call("/api/compare", "POST", {
    source: "live",
    mode: "market",
    concept: "Coffee",
    tagId: "urn:tag:test:coffee",
    candidates: [{ label: "Lahore" }, { label: "Islamabad" }],
  });
  expect(response.status).toBe(429);
  expect(response.data.error.code).toBe("RATE_LIMITED");
  expect(response.data.candidates).toBeUndefined();
});

it("distinguishes DNS, connection and timeout failures without exposing credentials", async () => {
  for (const [cause, expected] of [["ENOTFOUND", "QLOO_DNS"], ["EAI_AGAIN", "QLOO_DNS"], ["ECONNREFUSED", "QLOO_UNAVAILABLE"], ["SELF_SIGNED_CERT_IN_CHAIN", "QLOO_TLS"]]) {
    await expect(qloo("/search", {}, {
      env: { QLOO_API_KEY: "secret-test-value" },
      fetcher: async () => { throw Object.assign(new TypeError("fetch failed"), { cause: { code: cause } }); },
    })).rejects.toMatchObject({ status: 502, code: expected });
  }
  await expect(qloo("/search", {}, {
    env: { QLOO_API_KEY: "secret-test-value" },
    fetcher: async () => { throw new DOMException("timeout", "TimeoutError"); },
  })).rejects.toMatchObject({ status: 504, code: "QLOO_TIMEOUT" });
});

it("does not attach application timeout signals to Qloo requests", async () => {
  const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ results: [] }) }));
  for (const path of ["/v2/insights", "/search"])
    await qloo(path, {}, { env: { QLOO_API_KEY: "test" }, fetcher });
  expect(fetcher).toHaveBeenCalledTimes(2);
  for (const [, options] of fetcher.mock.calls)
    expect(options.signal).toBeUndefined();
});

it("preserves more than 100 tags per entity through comparison and report export", async () => {
  vi.stubEnv("QLOO_API_KEY", "test");
  const tags = Array.from({ length: 150 }, (_, i) => ({ id: `urn:tag:test:${i}`, name: `Tag ${i}`, type: "Test" }));
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ results: { entities: [{ entity_id: "a90e6260-9f61-4dfc-8b37-6527cccddf49", name: "Tagged place", tags }] } }) })));
  const compared = await call("/api/compare", "POST", { source: "live", mode: "market", concept: "Coffee", tagId: "urn:tag:test:coffee", candidates: [{ label: "Lahore" }, { label: "Islamabad" }] });
  expect(compared.status).toBe(200);
  expect(compared.data.candidates[0].entities[0].tags).toHaveLength(150);
  const report = await call("/api/report", "POST", { result: compared.data, format: "json" });
  expect(report.status).toBe(200);
  expect(report.data.analysis.rows).toHaveLength(150);
});
it("deduplicates repeated validation messages", async () => {
  const response = await call("/api/compare", "POST", { source: "live", mode: "market", concept: "x", candidates: [{ label: "a" }, { label: "b" }] });
  expect(response.status).toBe(400);
  const message = "Too small: expected string to have >=2 characters";
  expect(response.data.error.message.split(message)).toHaveLength(2);
});

it("uses the same verified reference and requests explanations for both cities", async () => {
  vi.stubEnv("QLOO_API_KEY", "test");
  const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ results: { entities: [] } }) }));
  vi.stubGlobal("fetch", fetcher);
  const id = "11111111-1111-4111-8111-111111111111";
  await liveComparison({ source: "live", mode: "market", concept: "Coffee", tagId: "urn:tag:test:coffee", referenceVenue: { id, name: "Reference cafe" }, candidates: [{ label: "Lahore" }, { label: "Islamabad" }] });
  expect(fetcher).toHaveBeenCalledTimes(2);
  for (const [url] of fetcher.mock.calls) {
    expect(url.searchParams.get("signal.interests.entities")).toBe(id);
    expect(url.searchParams.get("feature.explainability")).toBe("true");
  }
});

it("queries each selected interest in both cities and deduplicates the union", async () => {
  vi.stubEnv("QLOO_API_KEY", "test");
  const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ results: { entities: [{ entity_id: "11111111-1111-4111-8111-111111111111", name: "Shared place", tags: [] }] } }) }));
  vi.stubGlobal("fetch", fetcher);
  const result = await liveComparison({ mode: "market", source: "live", concept: "Coffee and books", interests: [{ id: "urn:tag:test:coffee", name: "Coffee" }, { id: "urn:tag:test:books", name: "Books" }], candidates: [{ label: "Lahore" }, { label: "Islamabad" }] });
  expect(fetcher).toHaveBeenCalledTimes(4);
  expect(result.candidates.every(candidate => candidate.entities.length === 1)).toBe(true);
  expect(JSON.parse(result.candidates[0].provenance.query.requests)).toHaveLength(2);
});

it("runs coverage research by default for City vs City comparisons", async () => {
  vi.stubEnv("QLOO_API_KEY", "test"); vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubGlobal("fetch", vi.fn(async url => ({ ok: true, json: async () => String(url).includes("/v2/tags") ? { results: { tags: [] } } : { results: { entities: [] } } })));
  const response = await call("/api/compare", "POST", { source: "live", mode: "market", concept: "Coffee", tagId: "urn:tag:test:coffee", candidates: [{ label: "Lahore" }, { label: "Islamabad" }] });
  expect(response.status).toBe(200);
  expect(response.data.research.trace.map(step => step.action)).toContain("Assess coverage");
  expect(response.data.research.trace.at(-1).detail).toContain("AI is not configured");
});

it("uses Qloo maximum page size and preserves every distinct place in a page", async () => {
  vi.stubEnv("QLOO_API_KEY", "test");
  const fetcher = vi.fn(async url => ({ ok: true, json: async () => ({ results: { entities: Array.from({ length: 50 }, (_, i) => ({ entity_id: `${url.searchParams.get("filter.tags")}:${i}`, name: `Place ${i}`, tags: [] })) } }) }));
  vi.stubGlobal("fetch", fetcher);
  const request = { source: "live", mode: "market", concept: "Coffee", interests: [{ id: "urn:tag:test:coffee", name: "Coffee" }, { id: "urn:tag:test:books", name: "Books" }], candidates: [{ label: "Lahore" }, { label: "Islamabad" }] };
  const response = await call("/api/places/page", "POST", { ...request, page: 2 });
  expect(response.status).toBe(200);
  expect(response.data.candidates[0].entities).toHaveLength(100);
  expect(response.data.paging).toEqual({ page: 2, pageSizePerInterest: 50, hasMore: true });
  for (const [url] of fetcher.mock.calls) { expect(url.searchParams.get("take")).toBe("50"); expect(url.searchParams.get("page")).toBe("2"); }
});
it("fetches and caches a matching place detail record", async () => {
  vi.stubEnv("QLOO_API_KEY", "test");
  const id = "bb111111-1111-4111-8111-111111111111";
  const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ results: [{ entity_id: id, name: "Detailed cafe", properties: { address: "Street 1", instagram: "https://www.instagram.com/example/" }, location: { lat: 33.7, lon: 73.1 }, tags: [] }] }) }));
  vi.stubGlobal("fetch", fetcher);
  const response = await call(`/api/entities/details?id=${id}`);
  expect(response.status).toBe(200);
  expect(response.data.entity.location.latitude).toBe(33.7);
  expect(response.data.entity.links[0].url).toBe("https://www.instagram.com/example/");
  await call(`/api/entities/details?id=${id}`);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
