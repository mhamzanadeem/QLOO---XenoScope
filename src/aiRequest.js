// Raw source metadata is for inspection/export, not for AI request transport.
export function compactAIResult(result) {
  return { ...result, candidates: result.candidates.map(candidate => ({
    ...candidate, provenance: { ...candidate.provenance, query: undefined },
    entities: candidate.entities.map(compactAIEntity),
  })) };
}
export function compactAIEntity(entity) {
  return { ...entity, description: entity.description.slice(0, 600), details: undefined, explanation: undefined, links: undefined };
}

export async function requestAI(path, payload, signal) {
  let response;
  try {
    response = await fetch(`/api${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("Could not reach the research service. Check your connection and retry. Your results are still available.");
  }
  let data;
  try { data = await response.json(); }
  catch {
    if ([502, 503, 504].includes(response.status)) throw new Error("The research service timed out or is temporarily unavailable. Please retry with a shorter question.");
    if (response.status === 413) throw new Error("This report is too large to send. Try a smaller result sample.");
    throw new Error("The research endpoint returned an unexpected response. Check that the latest API changes are deployed, then retry.");
  }
  if (!response.ok) throw new Error(data.error?.message || "The research request failed. Please retry.");
  return data;
}
