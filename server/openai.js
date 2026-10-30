export class AIError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

// Return safe, actionable diagnostics; never expose provider response bodies or keys.
export async function openAIResponse(payload, { env = process.env, fetcher = fetch, signal = AbortSignal.timeout(35000) } = {}) {
  let response;
  try {
    response = await fetcher("https://api.openai.com/v1/responses", {
      method: "POST", signal,
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    const code = error.cause?.code || error.code;
    if (signal.aborted || ["AbortError", "TimeoutError"].includes(error.name)) throw new AIError("AI_TIMEOUT", "The AI service took too long to respond. Please retry.");
    if (["ENOTFOUND", "EAI_AGAIN"].includes(code)) throw new AIError("AI_DNS", "The server could not resolve the OpenAI API hostname. Check the deployment's network connection and retry.");
    throw new AIError("AI_NETWORK", "The server could not connect to OpenAI. Please retry; if this continues, check the deployment's network access.");
  }
  let data;
  try { data = await response.json(); }
  catch {
    if (response.ok) throw new AIError("AI_RESPONSE", "OpenAI returned an unreadable response. Please retry.");
    data = {};
  }
  if (!response.ok) {
    if ([401, 403].includes(response.status)) throw new AIError("AI_ACCESS", "OpenAI rejected the API key or model access. Check the server's OpenAI configuration.");
    if (response.status === 429) throw new AIError("AI_QUOTA", "OpenAI quota or rate limit reached. Check API billing or try again later.");
    if (data.error?.code === "model_not_found" || response.status === 404) throw new AIError("AI_MODEL", "The configured OpenAI model is unavailable to this API key. Check OPENAI_MODEL and model access on the server.");
    if (response.status === 400) throw new AIError("AI_REQUEST", "OpenAI rejected the request settings. Check that the configured model supports Responses, structured outputs, and reasoning effort none.");
    throw new AIError("AI_UPSTREAM", "OpenAI is temporarily unavailable. Please retry.");
  }
  if (data.status !== "completed") throw new AIError("AI_INCOMPLETE", data.incomplete_details?.reason === "max_output_tokens" ? "The AI answer reached its output limit. Please ask a narrower question and retry." : "OpenAI did not finish the answer. Please retry.");
  if ((data.output || []).some(item => item.content?.some(part => part.type === "refusal"))) throw new AIError("AI_REFUSAL", "The AI service could not answer this request. Try a different research question.");
  return data;
}

export function aiFailure(error, fallback) {
  return { status: "unavailable", code: error instanceof AIError ? error.code : "AI_VALIDATION", reason: error instanceof AIError ? error.message : fallback };
}
