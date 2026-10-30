import { citySuggestions } from "./cities.js";
import { investorAdvice } from "./ai.js";
import { z } from "zod";
import { requestSchema, resultSchema } from "../shared/schema.js";
import { buildReport, toCSV } from "../shared/compare.js";
import { ApiError, qloo, readEntities, liveComparison, placeDetails } from "./qloo.js";

import { researchComparison } from "./research.js";
import { researchAssistant, assistantInput } from "./assistant.js";
import { reserveAssistantQuestion } from "./assistantUsage.js";

const searchSchema = z.string().trim().min(2).max(100);
const uuid = z.uuid();
// Best-effort per-instance protection. A platform WAF is needed for global limits.
const buckets = new Map();
function rateLimit(req) {
  const key = req.socket?.remoteAddress || "serverless";
  const now = Date.now();
  if (buckets.size > 1000) buckets.clear();
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.start > 60000)
    buckets.set(key, { start: now, count: 1 });
  else if (++bucket.count > 90)
    throw new ApiError(
      429,
      "RATE_LIMITED",
      "Too many requests. Please wait a minute.",
    );
}
async function body(req, maxBytes = 150000) {
  if (Number(req.headers["content-length"] || 0) > maxBytes)
    throw new ApiError(413, "TOO_LARGE", "Request is too large.");
  if (!String(req.headers["content-type"] || "").includes("application/json"))
    throw new ApiError(415, "CONTENT_TYPE", "Send application/json.");
  if (req.body !== undefined) {
    if (
      Buffer.byteLength(
        typeof req.body === "string" ? req.body : JSON.stringify(req.body),
      ) > maxBytes
    )
      throw new ApiError(413, "TOO_LARGE", "Request is too large.");
    try {
      return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    } catch {
      throw new ApiError(
        400,
        "INVALID_JSON",
        "Request must contain valid JSON.",
      );
    }
  }
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw) > maxBytes)
      throw new ApiError(413, "TOO_LARGE", "Request is too large.");
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Request must contain valid JSON.");
  }
}

export async function handleRequest(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    rateLimit(req);
    const url = new URL(req.url, "http://localhost");
    const path = (
      url.pathname === "/api" && url.searchParams.has("route")
        ? `/api/${url.searchParams.get("route")}`
        : url.pathname
    ).replace(/\/$/, "");
    const get = (route) => path === route && req.method === "GET";
    let data;
    if (get("/api/health")) data = { status: "ok" };
    else if (get("/api/cities/search")) data = { cities: citySuggestions(z.string().trim().min(1).max(100).parse(url.searchParams.get("q"))) };
    else if (get("/api/config"))
      data = {
        liveOnly: true,
        liveConfigured: Boolean(process.env.QLOO_API_KEY),
        assistantConfigured: Boolean(process.env.OPENAI_API_KEY),
        capabilities: {
          market: true,
          venue: true,
          conceptLive: true,
          demographics: false,
          heatmaps: false,
        },
      };
    else if (get("/api/qloo/status")) {
      await qloo("/search", {
        query: "coffee",
        types: "urn:entity:place",
        take: 1,
      });
      data = { accessible: true, provider: "Qloo" };
    } else if (get("/api/entities/search")) {
      const query = searchSchema.parse(url.searchParams.get("q"));
      data = {
        source: "live",
        entities: readEntities(
          await qloo("/search", { query, types: "urn:entity:place", take: 8 }),
          true,
        ),
      };
    } else if (get("/api/entities/details")) {
      data = { source: "live", entity: await placeDetails(uuid.parse(url.searchParams.get("id"))), retrievedAt: new Date().toISOString() };
    } else if (get("/api/tags/search")) {
      const query = searchSchema.parse(url.searchParams.get("q"));
      const response = await qloo("/v2/tags", {
        "filter.query": query,
        take: 12,
      });
      const tags = response.results?.tags ?? response.results;
      if (
        !Array.isArray(tags) ||
        tags.some(
          (t) => typeof t?.id !== "string" || typeof t?.name !== "string",
        )
      )
        throw new ApiError(
          502,
          "MALFORMED_RESPONSE",
          "Qloo returned an unsupported tag response.",
        );
      data = {
        source: "live",
        tags: tags.map((t) => ({
          id: t.id,
          name: t.name,
          category: t.type ?? "Cultural tag",
        })),
      };
    } else if (get("/api/insights")) {
      const entityId = url.searchParams.get("entityId");
      const tagId = url.searchParams.get("tagId");
      const location = url.searchParams.get("location");
      if (!entityId && !tagId)
        throw new ApiError(
          400,
          "INVALID_INPUT",
          "Provide a verified entityId or tagId.",
        );
      const params = { "filter.type": "urn:entity:place", take: 20 };
      if (entityId) params["signal.interests.entities"] = uuid.parse(entityId);
      if (tagId)
        params["filter.tags"] = z
          .string()
          .max(200)
          .regex(/^urn:tag:[a-zA-Z0-9_:.-]+$/)
          .parse(tagId);
      if (location) {
        params["filter.location.query"] = searchSchema.parse(location);
        params["filter.location.radius"] = 0;
      }
      data = {
        source: "live",
        entities: readEntities(await qloo("/v2/insights", params)),
      };
    } else if (path === "/api/assistant" && req.method === "POST") {
      const input = await body(req, 4000000);
      const parsed = assistantInput.parse(input);
      const result = resultSchema.parse(input.result);
      const allowance = process.env.OPENAI_API_KEY ? reserveAssistantQuestion(result.id) : undefined;
      data = await researchAssistant(result, parsed);
      if (allowance) data.allowance = allowance;
    } else if (["/api/compare", "/api/research", "/api/places/page"].includes(path) && req.method === "POST") {
      const input = await body(req);
      if (!input || typeof input !== "object" || Array.isArray(input)) throw new ApiError(400, "INVALID_INPUT", "Send a JSON object.");
      if (input.source && input.source !== "live")
        throw new ApiError(
          400,
          "LIVE_ONLY",
          "XenoScope uses live Qloo data only.",
        );
      const request = requestSchema.parse({ ...input, source: "live" });
      if (path === "/api/places/page") {
        data = await liveComparison(request, { page: z.number().int().min(1).max(1000).parse(input.page) });
      } else {
      data = path === "/api/research" || request.mode === "market"
        ? await researchComparison(request)
        : await liveComparison(request);
      data.ai = await investorAdvice(data);
      if (data.research) data.research.trace.push({
        action: "Prepare investor brief",
        detail: data.ai.status === "ready" ? "AI suggestions prepared with links to returned place evidence." : data.ai.status === "not-configured" ? "Deterministic evidence brief prepared; optional AI is not configured." : "Source evidence preserved; the optional AI brief was unavailable.",
      });
      }
      const parsedResult = resultSchema.safeParse(data);
      if (!parsedResult.success)
        throw new ApiError(502, "INVALID_QLOO_RESULT", "Qloo returned data that could not be processed. Please try another query.");
      data = parsedResult.data;
    } else if (get("/api/trends")) {
      const entityId = uuid.parse(url.searchParams.get("entityId"));
      const start = z.iso.date().parse(url.searchParams.get("start"));
      const end = z.iso.date().parse(url.searchParams.get("end"));
      if (start > end || Date.parse(end) - Date.parse(start) > 366 * 86400000)
        throw new ApiError(
          400,
          "INVALID_INPUT",
          "Use an ordered date range of at most one year.",
        );
      data = {
        source: "live",
        provider: "Qloo",
        endpoint: "/trends/entity",
        retrievedAt: new Date().toISOString(),
        raw: await qloo("/trends/entity", {
          entity_id: entityId,
          start_date: start,
          end_date: end,
          take: 20,
        }),
      };
    } else if (path === "/api/findings/brief" && req.method === "POST") {
      const input = await body(req, 4000000);
      const result = resultSchema.parse(input?.result);
      data = { advice: await investorAdvice(result) };
    } else if (path === "/api/report" && req.method === "POST") {
      // Reports include the returned entity metadata, not just a small query.
      const input = await body(req, 4000000);
      const format = z.enum(["json", "csv"]).parse(input?.format ?? "json");
      const result = resultSchema.parse(input?.result);
      if (result.source !== "live") throw new ApiError(400, "LIVE_ONLY", "Only Qloo explorations can be exported.");
      if (format === "csv") {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          'attachment; filename="xenoscope-report.csv"',
        );
        res.statusCode = 200;
        return res.end(toCSV(result));
      }
      data = buildReport(result);
    } else {
      const known = [
        "/api/health",
        "/api/assistant",
        "/api/cities/search",
        "/api/config",
        "/api/qloo/status",
        "/api/entities/search",
        "/api/entities/details",
        "/api/tags/search",
        "/api/insights",
        "/api/compare",
        "/api/places/page",
        "/api/research",
        "/api/trends",
        "/api/report",
        "/api/findings/brief",
      ].includes(path);
      throw new ApiError(
        known ? 405 : 404,
        known ? "METHOD_NOT_ALLOWED" : "NOT_FOUND",
        known ? "Method not allowed." : "API route not found.",
      );
    }
    res.statusCode = 200;
    res.end(JSON.stringify(data));
  } catch (error) {
    const validation = error instanceof z.ZodError;
    res.statusCode = validation ? 400 : error.status || 500;
    if (res.statusCode === 429 && error.code !== "EXPLORATION_LIMIT") res.setHeader("Retry-After", "60");
    res.end(
      JSON.stringify({
        error: {
          code: validation ? "INVALID_INPUT" : error.code || "REQUEST_FAILED",
          message: validation
            ? [...new Set(error.issues.map((i) => i.message))].slice(0, 5).join(" ")
            : error.status
              ? error.message
              : "The request could not be completed. Please retry.",
        },
      }),
    );
  }
}
