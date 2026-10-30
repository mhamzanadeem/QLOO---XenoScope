import { ApiError } from "./qloo.js";
import { ASSISTANT_PROMPT_LIMIT, ASSISTANT_LIMIT_MESSAGE } from "../shared/assistant-limit.js";

// Per-instance backstop, like the router's rate limiter. Browser usage persists
// across reloads/instances; strict distributed enforcement needs shared storage.
const usage = new Map();
export function reserveAssistantQuestion(id) {
  const now = Date.now();
  for (const [key, entry] of usage) if (entry.expires <= now) usage.delete(key);
  const entry = usage.get(id) || { used: 0, expires: now + 24 * 60 * 60 * 1000 };
  if (entry.used >= ASSISTANT_PROMPT_LIMIT) throw new ApiError(429, "EXPLORATION_LIMIT", ASSISTANT_LIMIT_MESSAGE);
  if (!usage.has(id) && usage.size >= 10000) throw new ApiError(503, "ASSISTANT_BUSY", "The research assistant is busy. Please try later.");
  entry.used++;
  usage.set(id, entry);
  return { used: entry.used, limit: ASSISTANT_PROMPT_LIMIT, remaining: ASSISTANT_PROMPT_LIMIT - entry.used };
}
