import { ASSISTANT_PROMPT_LIMIT, ASSISTANT_LIMIT_MESSAGE } from "../shared/assistant-limit.js";
const key = id => `xenoscope.assistant.usage.v1:${id}`;
export function assistantUsage(id) {
  try { return Math.min(ASSISTANT_PROMPT_LIMIT, Math.max(0, Number(localStorage.getItem(key(id))) || 0)); }
  catch { return 0; }
}
export async function reserveAssistantQuestion(id) {
  const reserve = () => {
    const used = assistantUsage(id);
    if (used >= ASSISTANT_PROMPT_LIMIT) throw new Error(ASSISTANT_LIMIT_MESSAGE);
    try { localStorage.setItem(key(id), String(used + 1)); }
    catch { throw new Error("Browser storage is unavailable. Enable it so the two-question allowance can be tracked before using the assistant."); }
    return used + 1;
  };
  // Serialize reservations between tabs where Web Locks are available.
  return navigator.locks?.request ? navigator.locks.request(key(id), reserve) : reserve();
}
