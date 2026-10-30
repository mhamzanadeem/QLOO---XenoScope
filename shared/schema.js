import { z } from "zod";

const text = z.string().trim().min(2).max(100);
const tagId = z
  .string()
  .max(200)
  .regex(/^urn:tag:[a-zA-Z0-9_:.-]+$/);
const candidate = z.object({
  label: text,
  entityId: z.uuid().optional(),
  tagId: tagId.optional(),
});
export const requestSchema = z
  .object({
    mode: z.enum(["market", "venue", "concept"]),
    source: z.literal("live"),
    concept: text,
    brief: z.object({
      audience: z.string().trim().max(300),
      features: z.array(z.string().trim().min(1).max(100)).max(12),
      decision: z.enum(["city", "neighborhood", "concept"]),
      constraints: z.string().trim().max(500),
    }).optional(),
    location: text.optional(),
    referenceVenue: z.object({ id: z.uuid(), name: text }).optional(),
    referenceVenues: z.array(z.object({ id: z.uuid(), name: text })).max(3).optional(),
    candidates: z.array(candidate).length(2),
    tagId: tagId.optional(),
    interests: z.array(z.object({ id: tagId, name: text })).max(3).optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.candidates[0].label.toLowerCase() ===
      data.candidates[1].label.toLowerCase()
    )
      ctx.addIssue({
        code: "custom",
        message: "Choose two different candidates.",
        path: ["candidates"],
      });
    const identity = data.mode === "venue" ? "entityId" : data.mode === "concept" ? "tagId" : null;
    if (identity && data.candidates[0][identity] && data.candidates[0][identity] === data.candidates[1][identity])
      ctx.addIssue({ code: "custom", message: "Choose two different venues or cultural tags.", path: ["candidates"] });
    if (data.mode === "concept" && !data.location)
      ctx.addIssue({
        code: "custom",
        message: "Choose a location for both concepts.",
        path: ["location"],
      });
    if (
      data.source === "live" &&
      data.mode === "venue" &&
      data.candidates.some((c) => !c.entityId)
    )
      ctx.addIssue({
        code: "custom",
        message: "Select both venues from live search results.",
        path: ["candidates"],
      });
    if (data.source === "live" && data.mode === "market" && !data.tagId && !data.interests?.length)
      ctx.addIssue({
        code: "custom",
        message: "Select a verified Qloo tag to anchor the live query.",
        path: ["tagId"],
      });
    if (
      data.source === "live" &&
      data.mode === "concept" &&
      data.candidates.some((c) => !c.tagId)
    )
      ctx.addIssue({
        code: "custom",
        message: "Select a verified Qloo tag for each concept.",
        path: ["candidates"],
      });
  });

const tag = z.object({
  id: z.string().max(200),
  name: z.string().max(200),
  category: z.string().max(200),
});
export const entitySchema = z.object({
  id: z.string().max(200),
  name: z.string().max(200),
  description: z.string().max(5000),
  // Qloo can return more than 100 tags per place. Validate every tag without truncating evidence.
  tags: z.array(tag),
  affinity: z.number().nullable(),
  popularity: z.number().nullable(),
  geography: z.string().max(300).nullable(),
  website: z.string().url().regex(/^https?:\/\//).nullable().optional(),
  address: z.string().max(1000).nullable().optional(),
  explanation: z.string().max(20000).nullable().optional(),
  location: z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) }).nullable().optional(),
  links: z.array(z.object({ label: z.string().max(100), url: z.string().url().regex(/^https?:\/\//) })).max(10).optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});
export const resultSchema = z
  .object({
    id: z.string().max(100),
    createdAt: z.iso.datetime(),
    source: z.literal("live"),
    request: requestSchema,
    paging: z.object({ page: z.number().int().min(1).max(1000), pageSizePerInterest: z.literal(50), hasMore: z.boolean() }).optional(),
    ai: z.object({
      status: z.enum(["ready", "unavailable", "not-configured"]),
      model: z.string().max(100).optional(), reason: z.string().max(500).optional(),
      headline: z.string().max(600).optional(),
      findings: z.array(z.object({ text: z.string().max(600), evidenceIds: z.array(z.string().max(200)).max(4) })).max(4).optional(),
      risks: z.array(z.string().max(600)).max(4).optional(),
      nextSteps: z.array(z.string().max(600)).max(4).optional(),
      inputTokens: z.number().nonnegative().optional(), outputTokens: z.number().nonnegative().optional(), cached: z.boolean().optional(),
    }).optional(),
    research: z.object({
      status: z.enum(["evidence-returned", "limited-evidence"]),
      trace: z.array(z.object({ action: z.string().max(100), detail: z.string().max(1000) })).max(5),
      evidence: z.array(z.object({ id: z.string().max(200), name: z.string().max(200), counts: z.array(z.number().int().nonnegative()).length(2) })).max(3),
      alternatives: z.array(z.object({ id: z.string().max(200), name: z.string().max(200) })).max(5),
      nextStep: z.string().max(2000),
      caveat: z.string().max(1000),
    }).optional(),
    candidates: z
      .array(
        z.object({
          label: z.string().max(100),
          entities: z.array(entitySchema).max(150),
          provenance: z.object({
            provider: z.string().max(100),
            endpoint: z.string().max(100),
            retrievedAt: z.iso.datetime(),
            illustrative: z.boolean(),
            query: z.record(z.string(), z.string()).optional(),
          }),
        }),
      )
      .length(2),
  })
  .superRefine((result, ctx) => {
    if (result.candidates.some((c, i) => c.label !== result.request.candidates[i].label))
      ctx.addIssue({ code: "custom", message: "Candidate labels must match the request.", path: ["candidates"] });
    if (
      result.source !== result.request.source ||
      result.candidates.some(
        (c) => c.provenance.illustrative !== false,
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Result source and provenance must agree.",
        path: ["source"],
      });
  });
