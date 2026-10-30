import { compactAIResult, compactAIEntity, requestAI } from "./aiRequest.js";
import { assistantUsage, reserveAssistantQuestion } from "./assistantUsage.js";
import { ASSISTANT_PROMPT_LIMIT, ASSISTANT_LIMIT_MESSAGE } from "../shared/assistant-limit.js";
import { useEffect, useRef, useState } from "react";
import Link from "./AppLink.jsx";
import { ArrowUpRight, LoaderCircle, MessageCircle, Send, Sparkles } from "lucide-react";

const prompts = ["Which places should I visit first, and why?", "What is still unknown about my requirements?", "Find another relevant interest and investigate it in both cities."];
export default function ResearchAssistant({ result, configured }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [used, setUsed] = useState(() => assistantUsage(result.id));
  const remaining = Math.max(0, ASSISTANT_PROMPT_LIMIT - used);
  const pending = useRef(null);
  const latest = useRef(null);
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => {
    const sync = () => setUsed(assistantUsage(result.id));
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [result.id]);
  useEffect(() => { if (messages.length) latest.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" }); }, [messages.length]);
  async function ask(text = question) {
    const query = text.trim();
    if (pending.current || query.length < 2 || configured === false || remaining === 0) return;
    const controller = new AbortController();
    pending.current = controller; setLoading(true); setError("");
    try {
      setUsed(await reserveAssistantQuestion(result.id));
      const history = messages.flatMap(m => [{ role: "user", content: m.question }, { role: "assistant", content: [m.summary, ...m.points, ...m.nextSteps].join("\n") }]).slice(-8);
      const previousEvidence = [...new Map(messages.flatMap(m => (m.sources || []).map(s => [s.id, s.entity])).filter(([, entity]) => entity)).values()].slice(-24).map(compactAIEntity);
      const answer = await requestAI("/assistant", { result: compactAIResult(result), question: query, history, previousEvidence }, controller.signal);
      if (answer.status !== "ready") throw new Error(answer.reason || answer.error?.message || "The assistant is unavailable. Please retry.");
      setMessages(current => [...current, { question: query, ...answer }]); setQuestion("");
    } catch (e) { if (e.name !== "AbortError") { setError(e.message); setQuestion(query); } }
    finally { if (pending.current === controller) { pending.current = null; setLoading(false); } }
  }
  const originalIds = new Set(result.candidates.flatMap(c => c.entities.map(e => e.id)));
  return <section id="research-assistant" className="panel research-assistant" aria-labelledby="assistant-title">
    <div className="assistant-heading"><span className="assistant-symbol"><MessageCircle size={24} /></span><div><span className="eyebrow">GO ONE STEP FURTHER</span><h2 id="assistant-title">Discuss your results</h2></div><span className="badge teal"><Sparkles size={12} /> Research assistant</span></div>
    <p className="assistant-intro">Your brief and Qloo results are already in context. Ask a question, inspect a place, or explore a new interest.</p>
    <div className="outcome-badges"><span className="badge">{result.candidates.map(c => c.label).join(" ↔ ")}</span><span className="badge">{result.candidates.reduce((sum, c) => sum + c.entities.length, 0)} returned places</span><span className="badge" aria-live="polite">{remaining} of {ASSISTANT_PROMPT_LIMIT} questions left</span></div>
    {configured === false ? <p role="status" className="assistant-error">The assistant is not configured on this deployment. Your comparison and evidence remain available.</p> : <>
      {!messages.length && <div className="assistant-prompts">{prompts.filter((_, i) => result.request.mode !== "venue" || i !== 2).map(prompt => <button className="assistant-prompt" key={prompt} onClick={() => ask(prompt)} disabled={loading || remaining === 0}>{prompt}<ArrowUpRight size={15} /></button>)}</div>}
      <div className="assistant-conversation" role="log" aria-label="Research conversation" aria-live="polite" aria-relevant="additions" aria-busy={loading}>
        {messages.map((message, index) => <article className="assistant-turn" key={index}>
          <div className="assistant-question"><span className="eyebrow">YOU</span><p>{message.question}</p></div>
          <div className="assistant-answer"><span className="eyebrow">RESEARCH ASSISTANT</span><p className="assistant-summary">{message.summary}</p>
            {message.points.length > 0 && <ul>{message.points.map((point, i) => <li key={i}>{point}</li>)}</ul>}
            {message.nextSteps.length > 0 && <div className="assistant-next"><h3>Try next</h3><ul>{message.nextSteps.map((step, i) => <li key={i}>{step}</li>)}</ul></div>}
            {message.sources?.length > 0 && <details><summary>{message.sources.length} supporting sources</summary><div className="assistant-sources">{message.sources.map(source => <article key={source.id}>
              {originalIds.has(source.id) ? <Link className="evidence-link" to={`/findings/${encodeURIComponent(source.id)}`}>{source.name}</Link> : <strong>{source.name}</strong>}
              <small>{source.origin}</small><p>{source.entity.address || source.entity.geography || "Location details unavailable"}</p>
              <p>{source.entity.description?.slice(0, 320)}</p><div className="outcome-badges">{source.entity.tags?.slice(0, 5).map(tag => <span className="badge" key={tag.id}>{tag.name}</span>)}</div>
            </article>)}</div></details>}
            <details className="assistant-trace"><summary>{message.trace?.length ? `${message.trace.length} research actions` : "Answered from your existing results"}</summary><ol>{message.trace?.map((step, i) => <li key={i}><strong>{step.action}</strong> · {step.detail}</li>)}</ol></details>
          </div>
        </article>)}<div ref={latest} />
      </div>
      {loading && <p className="assistant-loading" role="status"><LoaderCircle size={16} className="spin" /> Reviewing your question and researching when needed…</p>}
      {error && <p className="assistant-error" role="alert">{error}</p>}
      {!loading && remaining === 0 && <p className="assistant-error">{ASSISTANT_LIMIT_MESSAGE}</p>}
      <form className="assistant-composer" onSubmit={event => { event.preventDefault(); ask(); }}>
        <label htmlFor="research-question">Ask about this comparison</label>
        <textarea id="research-question" value={question} onChange={event => setQuestion(event.target.value)} maxLength={2000} rows={2} placeholder="What should I investigate before choosing a city?" disabled={loading || remaining === 0} />
        <div><small>Two submitted questions per exploration, including suggested questions and retries.</small><button className="button primary" type="submit" disabled={loading || remaining === 0 || question.trim().length < 2}><Send size={15} /> {loading ? "Researching…" : "Ask assistant"}</button></div>
      </form>
      <p className="assistant-footnote">AI suggestions need verification. Qloo place data does not establish demand, rent, or profitability. Conversation lasts while this results page is open.</p>
    </>}
  </section>;
}
