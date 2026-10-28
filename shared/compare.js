export const normalizeId = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();
export const uniqueById = (items) => [
  ...new Map(
    items
      .filter((i) => i.id)
      .map((i) => [normalizeId(i.id), { ...i, id: normalizeId(i.id) }]),
  ).values(),
];
const finite = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Normalize Qloo entities without substituting zero for unavailable measures. */
export function normalizeEntity(e) {
  return {
    id: normalizeId(e.entity_id ?? e.id),
    name: String(e.name ?? "Unnamed entity"),
    description: String(e.properties?.description ?? e.description ?? ""),
    tags: uniqueById(
      (Array.isArray(e.tags) ? e.tags : [])
        .filter((t) => t.id && t.name)
        .map((t) => ({
          id: t.id,
          name: t.name,
          category: t.type ?? t.category ?? "Cultural tag",
        })),
    ),
    affinity: finite(e.query?.affinity),
    popularity: finite(e.popularity),
    geography: e.properties?.geocode?.name ?? e.geography ?? null,
  };
}

export function compareNumber(a, b, unitA, unitB) {
  if (finite(a) === null || finite(b) === null)
    return { status: "missing", delta: null };
  if (unitA !== unitB) return { status: "incompatible", delta: null };
  return { status: "comparable", delta: a - b };
}

export function compareCandidates(candidates) {
  const [a, b] = candidates;
  const tags = candidates.map((c) =>
    uniqueById(c.entities.flatMap((e) => e.tags)),
  );
  const rows = uniqueById(tags.flat()).map((tag) => {
    const counts = candidates.map(
      (c) =>
        c.entities.filter((e) =>
          e.tags.some((t) => normalizeId(t.id) === tag.id),
        ).length,
    );
    return {
      ...tag,
      a: counts[0],
      b: counts[1],
      shared: counts.every((n) => n > 0),
      delta: counts[0] - counts[1],
    };
  });
  const shared = rows.filter((r) => r.shared).length;
  const coverage = candidates.map((c) => ({
    total: c.entities.length,
    tagged: c.entities.filter((e) => e.tags.length).length,
    geography: c.entities.filter((e) => e.geography).length,
    affinity: c.entities.filter((e) => e.affinity !== null).length,
  }));
  return {
    rows,
    shared,
    coverage,
    summary: rows.length
      ? `${shared} shared tags and ${rows.length - shared} tags found in only one result set. ${a.label} returned ${a.entities.length} entities; ${b.label} returned ${b.entities.length}. Result counts can reflect data coverage, not demand.`
      : "No cultural tags were returned. The available data does not support a tag comparison.",
  };
}

export function filterRows(
  rows,
  { differences = false, query = "", category = "", sort = "difference" } = {},
) {
  return rows
    .filter(
      (r) =>
        (!differences || !r.shared) &&
        (!category || r.category === category) &&
        r.name.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "a"
          ? b.a - a.a
          : sort === "b"
            ? b.b - a.b
            : Math.abs(b.delta) - Math.abs(a.delta) ||
              a.name.localeCompare(b.name),
    );
}

export const limitations = [
  "Cultural affinity does not predict revenue, profitability, foot traffic, market demand, or business success.",
  "Results are bounded samples, not a census. A missing tag means not returned, not absent from the market.",
  "Tag counts describe returned entities. Query coverage and metadata completeness may differ.",
  "Demographic, heatmap, trend, and financial data are not part of this comparison.",
];
export const questions = [
  "Which customers would choose this concept, and why?",
  "What do on-site observations and customer interviews show?",
  "What are the local rents, operating costs, and competitive alternatives?",
  "Would a small pilot produce repeat visits at a viable price?",
];
export function buildReport(result) {
  return {
    ...result,
    analysis: compareCandidates(result.candidates),
    methodology:
      "Deduplicate entities and tags by case-insensitive source ID. Count each tag once per entity. Align tag IDs across the two bounded result sets; subtract B count from A count. Missing metrics remain null. No market success ranking is computed.",
    limitations,
    validationQuestions: questions,
    attribution: "Qloo API, transformed deterministically by XenoScope.",
  };
}
const csvCell = (value) => {
  let text = String(value ?? "");
  if (/^\s*[=+@-]|^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};
export function toCSV(result) {
  const report = buildReport(result);
  const rows = [
    ["XenoScope comparison", result.source.toUpperCase(), result.createdAt],
    ["Concept", result.request.concept],
    ["Signal", result.candidates[0].label, result.candidates[1].label, "Unit"],
    ...report.analysis.rows.map((r) => [
      r.name,
      r.a,
      r.b,
      "returned entities with tag",
    ]),
    ["Methodology", report.methodology],
    ["Source", report.attribution],
    ...result.candidates.map((c) => [
      "Provenance",
      c.label,
      JSON.stringify(c.provenance),
    ]),
    ...limitations.map((l) => ["Limitation", l]),
    ...questions.map((q) => ["Validate next", q]),
  ];
  return "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}
