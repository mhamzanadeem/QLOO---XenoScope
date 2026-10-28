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
    });
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError")
      throw new ApiError(504, "QLOO_TIMEOUT", "The connection to Qloo was interrupted or timed out outside the application. Please retry.");
    const networkCode = error.cause?.code || error.code;
    if (["ENOTFOUND", "EAI_AGAIN"].includes(networkCode))
      throw new ApiError(502, "QLOO_DNS", "The server cannot resolve the Qloo API hostname. Check QLOO_BASE_URL and the server's DNS or internet connection.");
    if (["CERT_HAS_EXPIRED", "DEPTH_ZERO_SELF_SIGNED_CERT", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "SELF_SIGNED_CERT_IN_CHAIN"].includes(networkCode))
      throw new ApiError(502, "QLOO_TLS", "The server could not verify Qloo's secure connection. Check the server clock, trusted certificates, or network proxy.");
    throw new ApiError(502, "QLOO_UNAVAILABLE", "The server could not connect to Qloo. Check the server's internet connection, firewall, or proxy and retry.");
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
  return uniqueById(rows.map(normalizeEntity));
}

export async function liveComparison(request, { page = 1 } = {}) {
  const candidates = await Promise.all(
    request.candidates.map(async (candidate) => {
      // Same entity type and result limit on each side; no scores compared across queries.
      const params = { "filter.type": "urn:entity:place", take: 50, page };
      if (request.mode === "venue")
        params["signal.interests.entities"] = candidate.entityId;
      else {
        params["filter.tags"] =
          request.mode === "concept" ? candidate.tagId : request.tagId;
        params["filter.location.query"] =
          request.mode === "market" ? candidate.label : request.location;
      }
      if (request.mode !== "venue") params["filter.location.radius"] = 0;
      const references = request.referenceVenues?.length ? request.referenceVenues : request.referenceVenue ? [request.referenceVenue] : [];
      if (references.length && request.mode === "market") {
        params["signal.interests.entities"] = [...new Set(references.map(reference => reference.id))].join(",");
        params["feature.explainability"] = true;
      }
      if (request.mode === "venue") params["feature.explainability"] = true;
      const interestIds = request.mode === "market" && request.interests?.length ? [...new Set(request.interests.map(interest => interest.id))] : [params["filter.tags"]];
      // Separate verified-interest queries provide explicit OR semantics without
      // relying on an account-specific multi-filter operator.
      const queries = interestIds.map(id => ({ ...params, ...(id ? { "filter.tags": id } : {}) }));
      const responses = await Promise.all(queries.map(query => qloo("/v2/insights", query)));
      const entities = uniqueById(responses.flatMap(data => readEntities(data)));
      return {
        label: candidate.label,
        entities,
        hasMore: responses.some(data => (data.results?.entities?.length || 0) === 50),
        provenance: {
          provider: "Qloo",
          endpoint: "/v2/insights",
          retrievedAt: new Date().toISOString(),
          illustrative: false,
          query: queries.length === 1 ? Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) : {
            strategy: "Separate interest queries; union by entity ID; 50 places per interest per page",
            requests: JSON.stringify(queries),
          },
        },
      };
    }),
  );
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    source: "live",
    request,
    paging: { page, pageSizePerInterest: 50, hasMore: candidates.some(candidate => candidate.hasMore) },
    candidates,
  };
}

const detailCache = new Map();
const detailPending = new Map();
export async function placeDetails(id) {
  const cached = detailCache.get(id);
  if (cached && cached.expires > Date.now()) return cached.entity;
  if (detailPending.has(id)) return detailPending.get(id);
  const task = (async () => {
    const data = await qloo("/entities", { entity_ids: id });
    const rows = Array.isArray(data.results) ? data.results : data.results?.entities ?? data.entities;
    if (!Array.isArray(rows)) throw new ApiError(502, "MALFORMED_RESPONSE", "Qloo returned an unsupported place detail response.");
    const row = rows.find(entity => String(entity.entity_id ?? entity.id).toLowerCase() === id.toLowerCase());
    if (!row) throw new ApiError(404, "PLACE_NOT_FOUND", "Qloo did not return details for this place.");
    const entity = normalizeEntity(row);
    if (detailCache.size >= 250) detailCache.clear();
    detailCache.set(id, { entity, expires: Date.now() + 600000 });
    return entity;
  })();
  detailPending.set(id, task);
  try { return await task; } finally { detailPending.delete(id); }
}
