import entities from "./fixtures/entities.json" with { type: "json" };
// Synthetic responses used only by automated tests. Never imported by runtime code.
export function liveFixture(request) {
  const input = request || { mode: "market", source: "live", concept: "Specialty coffee", tagId: "urn:tag:offerings:place:coffee", candidates: [{ label: "Lahore" }, { label: "Islamabad" }] };
  const createdAt = new Date().toISOString();
  return {
    id: crypto.randomUUID(), createdAt, source: "live", request: input,
    candidates: input.candidates.map((candidate, index) => ({
      label: candidate.label,
      entities: structuredClone(entities.slice(index * 4, index * 4 + 4)),
      provenance: { provider: "Qloo test fixture", endpoint: "/v2/insights", retrievedAt: createdAt, illustrative: false },
    })),
  };
}
