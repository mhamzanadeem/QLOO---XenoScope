import { normalizeEntity, uniqueById } from "../shared/compare.js";

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export function upstreamError(status) {
  if (status === 429)
    return new ApiError(
      429,
      "RATE_LIMITED",
      "Qloo is rate limiting requests. Wait a moment and retry.",
    );
  if (status === 401 || status === 403)
    return new ApiError(
      502,
      "QLOO_AUTH",
      "Qloo rejected the server credentials or this account lacks access. Check the server configuration.",
    );
  if (status === 400 || status === 422)
    return new ApiError(
      422,
      "UNSUPPORTED_QUERY",
      "Qloo could not support this query. Try another tag, venue, or location.",
    );
  return new ApiError(
    502,
    "UPSTREAM_ERROR",
    "Qloo is unavailable right now. Please retry the connection.",
  );
}

export async function qloo(
  path,
  params,
  { fetcher = fetch, env = process.env } = {},
) {
  if (!env.QLOO_API_KEY)
    throw new ApiError(
      503,
      "NOT_CONFIGURED",
      "Qloo access is not configured. Set QLOO_API_KEY on the server and restart the application.",
    );
  const base = env.QLOO_BASE_URL || "https://api.qloo.com";
  if (
    ![
      "https://api.qloo.com",
      "https://staging.api.qloo.com",
      "https://hackathon.api.qloo.com",
    ].includes(base.replace(/\/$/, ""))
  )
    throw new ApiError(
      503,
      "INVALID_CONFIG",
      "QLOO_BASE_URL must be an official Qloo API host.",
    );
  const url = new URL(path, base);
  for (const [key, value] of Object.entries(params))
    if (value !== undefined && value !== "")
      url.searchParams.set(key, String(value));
  let response;
  try {
    response = await fetcher(url, {
      headers: { "X-Api-Key": env.QLOO_API_KEY, accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    });
  } catch (error) {
    throw new ApiError(
      error.name === "TimeoutError" || error.name === "AbortError" ? 504 : 502,
      "QLOO_UNAVAILABLE",
      "Qloo could not be reached within the request window. Please retry the connection.",
    );
  }
  if (!response.ok) throw upstreamError(response.status);
  let data;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(
      502,
      "MALFORMED_RESPONSE",
      "Qloo returned an unreadable response. Please retry.",
    );
  }
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    data.success === false
  )
    throw new ApiError(
      502,
      "MALFORMED_RESPONSE",
      "Qloo returned an unexpected response.",
    );
  return data;
}

export function readEntities(data, search = false) {
  const rows = search
    ? Array.isArray(data.results)
      ? data.results
      : data.results?.entities
    : data.results?.entities;
  if (
    !Array.isArray(rows) ||
    rows.some(
      (e) =>
        !e ||
        typeof e.name !== "string" ||
        typeof (e.entity_id ?? e.id) !== "string",
    )
  )
    throw new ApiError(
      502,
      "MALFORMED_RESPONSE",
      "Qloo returned an unsupported entity response.",
    );
  return uniqueById(rows.slice(0, 30).map(normalizeEntity));
}

export async function liveComparison(request) {
  const candidates = await Promise.all(
    request.candidates.map(async (candidate) => {
      // Same entity type and result limit on each side; no scores compared across queries.
      const params = { "filter.type": "urn:entity:place", take: 20 };
      if (request.mode === "venue")
        params["signal.interests.entities"] = candidate.entityId;
      else {
        params["filter.tags"] =
          request.mode === "concept" ? candidate.tagId : request.tagId;
        params["filter.geocode.name"] =
          request.mode === "market" ? candidate.label : request.location;
      }
      const data = await qloo("/v2/insights", params);
      return {
        label: candidate.label,
        entities: readEntities(data),
        provenance: {
          provider: "Qloo",
          endpoint: "/v2/insights",
          retrievedAt: new Date().toISOString(),
          illustrative: false,
          query: Object.fromEntries(
            Object.entries(params).map(([k, v]) => [k, String(v)]),
          ),
        },
      };
    }),
  );
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    source: "live",
    request,
    candidates,
  };
}
