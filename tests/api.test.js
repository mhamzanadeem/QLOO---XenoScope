import { it, expect, vi, afterEach } from "vitest";
import {
  qloo,
  readEntities,
  upstreamError,
  liveComparison,
} from "../server/qloo.js";
import { handleRequest } from "../server/router.js";
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
  expect(fetcher.mock.calls[0][0].searchParams.get("filter.geocode.name")).toBe(
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
  expect(fetcher.mock.calls[1][0].searchParams.get("filter.geocode.name")).toBe(
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
