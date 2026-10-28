import { liveComparison, qloo } from "./qloo.js";
import { compareCandidates } from "../shared/compare.js";

// A bounded research workflow: retrieve, inspect evidence, then choose a next tool.
export async function researchComparison(request) {
  const trace = [{ action: "Compare", detail: "Retrieve two equally bounded Qloo result sets." }];
  const result = await liveComparison(request);
  const analysis = compareCandidates(result.candidates);
  const sufficient = analysis.coverage.every(c => c.tagged >= 3);
  trace.push({ action: "Assess coverage", detail: analysis.coverage.map((c, i) => `${result.candidates[i].label}: ${c.tagged} of ${c.total} places have tags.`).join(" ") });
  let alternatives = [];
  if (!sufficient && request.mode !== "venue") {
    try {
      const data = await qloo("/v2/tags", { "filter.query": request.concept, take: 5 });
      const tags = data.results?.tags ?? data.results;
      alternatives = Array.isArray(tags) ? tags.filter(t => typeof t.id === "string" && typeof t.name === "string").slice(0, 5).map(t => ({ id: t.id, name: t.name })) : [];
      trace.push({ action: "Find alternatives", detail: "Coverage is limited. Search for alternative tags without silently changing your question." });
    } catch {
      trace.push({ action: "Find alternatives", detail: "Alternative-tag search was unavailable. The original comparison is preserved." });
    }
  }
  const evidence = analysis.rows.filter(r => r.shared).slice(0, 3).map(r => ({ id: r.id, name: r.name, counts: [r.a, r.b] }));
  result.research = {
    status: sufficient ? "evidence-returned" : "limited-evidence",
    trace,
    evidence,
    alternatives,
    nextStep: sufficient ? `Interview five prospective customers in each location about ${request.concept}. Use the shared interests below as interview prompts, then test one small event before committing to a location.` : "Try another verified tag or venue. These samples do not support a reliable cultural comparison.",
    caveat: "Coverage thresholds describe metadata completeness, not confidence in market demand. No location winner is inferred.",
  };
  return result;
}
