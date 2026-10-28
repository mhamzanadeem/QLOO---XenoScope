const normalize = value => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
// Exact normalized feature labels only: no invented semantic or demand inference.
export function decisionBrief(result) {
  const brief = result.request.brief;
  const requirements = (brief?.features || []).map(feature => ({
    feature,
    matches: result.candidates.map(candidate => candidate.entities.filter(entity => entity.tags.some(tag => normalize(tag.name) === normalize(feature))).map(entity => ({ id: entity.id, name: entity.name }))),
  }));
  const populated = result.candidates.filter(candidate => candidate.entities.length > 0);
  return {
    recommendation: !populated.length ? "Refine the search before choosing a location." : populated.length < 2 ? "Investigate the missing location before comparing options." : requirements.some(row => row.matches.some(matches => matches.length)) ? "Shortlist the documented examples below for site visits; a location winner is not established." : "Compare the returned places through site visits before choosing a location.",
    requirements,
    cityEvidence: result.candidates.map(candidate => ({
      label: candidate.label,
      sampleSize: candidate.entities.length,
      documentedRequirements: requirements.filter(row => row.matches[result.candidates.indexOf(candidate)].length > 0).length,
      shortlist: candidate.entities.map(entity => ({
        id: entity.id, name: entity.name, website: entity.website || null,
        matchedFeatures: (brief?.features || []).filter(feature => entity.tags.some(tag => normalize(tag.name) === normalize(feature))),
        description: entity.description,
      })).sort((a, b) => b.matchedFeatures.length - a.matchedFeatures.length || a.name.localeCompare(b.name)).slice(0, 3),
      commonFeatures: [...new Map(candidate.entities.flatMap(entity => entity.tags).map(tag => [tag.id, tag])).values()].map(tag => ({ id: tag.id, name: tag.name, count: candidate.entities.filter(entity => entity.tags.some(t => t.id === tag.id)).length })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 5),
    })),
    nextSteps: [
      brief?.audience ? `Interview prospective customers from your target audience: ${brief.audience}.` : "Identify your target customers and interview them in each location.",
      "Visit the linked places during your intended opening hours and verify the required facilities.",
      brief?.constraints ? `Check your constraints against local quotes and observations: ${brief.constraints}.` : "Obtain rent quotations and estimate staffing and operating costs.",
      "Test the concept with a small event or pop-up before signing a lease.",
    ],
    unknowns: ["Customer demand and willingness to pay", "Rent, operating costs, and profitability", "Complete competitor counts", ...(brief?.decision === "neighborhood" ? ["Neighborhood suitability: this city-level search does not compare neighborhoods"] : [])],
  };
}
