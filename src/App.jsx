import ResearchAssistant from "./ResearchAssistant.jsx";
import Link, { ResultNavigationContext } from "./AppLink.jsx";
import { compactAIResult, requestAI } from "./aiRequest.js";
import CitySearch from "./CitySearch.jsx";
import { cityScenarios } from "./scenarios.js";
import { decisionBrief } from "../shared/decision.js";
import { readableLabel, featureCategory } from "./labels.js";
import { lazy, Suspense, useEffect, useMemo, useState, useId } from "react";
import {
  Navigate,
  Routes,
  Route,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Building2,
  Check,
  ChevronLeft,
  Compass,
  Download,
  FileText,
  FlaskConical,
  Layers3,
  MapPin,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
  Info,
  LoaderCircle,
  ExternalLink,
} from "lucide-react";
import { requestSchema } from "../shared/schema.js";
import {
  compareCandidates,
  filterRows,
  buildReport,
  limitations,
  questions,
} from "../shared/compare.js";
import QlooModal from "./QlooModal.jsx";
import { api, readSaved, saveResult, deleteSaved, download, cacheNavigationResult, readNavigationResult } from "./store.js";
const SignalChart = lazy(() => import("./SignalChart.jsx"));
const modes = [
  {
    id: "market",
    icon: MapPin,
    name: "City vs City",
    description: "Explore how cultural signals differ between two cities.",
    example: "Lahore ↔ Islamabad",
  },
  {
    id: "venue",
    icon: Building2,
    name: "Venue vs Venue",
    description: "Investigate the interests surrounding two places.",
    example: "Independent café ↔ Reading room",
  },
  {
    id: "concept",
    icon: FlaskConical,
    name: "Concept vs Concept",
    description: "Compare two ideas within the same location.",
    example: "Specialty coffee ↔ Independent bookshop",
  },
];
const Source = () => (
  <span className="badge teal"><span className="dot" />LIVE · QLOO</span>
);
const Button = ({ children, className = "", ...props }) => (
  <button className={`button ${className}`} {...props}>
    {children}
  </button>
);
const Title = ({ title, children }) => (
  <header className="page-title">
    <h1>{title}</h1>
    {children && <p className="intro">{children}</p>}
  </header>
);
function Notice({ children, error = false }) {
  return (
    <div
      className={`notice ${error ? "error" : ""}`}
      role={error ? "alert" : undefined}
    >
      <Info size={17} />
      <div>{children}</div>
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const [result, setResult] = useState(() => readNavigationResult(new URLSearchParams(location.search).get("exploration")));
  const [config, setConfig] = useState(null);
  const [configError, setConfigError] = useState("");
  const [unavailable, setUnavailable] = useState("");
  const [retrying, setRetrying] = useState(false);
  async function checkConnection() {
    setRetrying(true);
    try {
      await api("/qloo/status");
      setUnavailable("");
    } catch (e) {
      setUnavailable(e.message);
    } finally {
      setRetrying(false);
    }
  }
  useEffect(() => { if (result) cacheNavigationResult(result); }, [result]);
  useEffect(() => {
    const handleUnavailable = (event) => setUnavailable(event.detail.message);
    window.addEventListener("qloo-unavailable", handleUnavailable);
    api("/config")
      .then(setConfig)
      .catch((e) => setConfigError(e.message));
    checkConnection();
    return () =>
      window.removeEventListener("qloo-unavailable", handleUnavailable);
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  const landing = location.pathname === "/";
  const context = { result, setResult, config };
  return (
    <ResultNavigationContext.Provider value={result}><div className={landing ? "app landing-app" : "app workspace-app"}>
      <QlooModal
        message={unavailable}
        retrying={retrying}
        onRetry={checkConnection}
        onClose={() => setUnavailable("")}
      />
      <a href="#main" className="skip">
        Skip to content
      </a>
      {landing && (
        <nav className="landing-nav">
          <Link to="/" aria-label="XenoScope home">
            <img src="/brand/xenoscope-logo.svg" alt="XenoScope" width="172" />
          </Link>
          <div>
            <Link to="/build/market">Compare</Link>
            <Link to="/methodology">Methodology</Link>
            <Link to="/saved">Saved explorations</Link>
          </div>
          <Link to="/build/market" className="button small">
            Compare cities <ArrowUpRight size={15} />
          </Link>
        </nav>
      )}
      <div className="main-wrap">
        <main id="main" className={landing ? "" : "page"}>
          {configError && (
            <Notice error>
              Configuration could not be loaded: {configError}{" "}
              <Button
                onClick={() => {
                  setConfigError("");
                  api("/config")
                    .then(setConfig)
                    .catch((e) => setConfigError(e.message));
                }}
              >
                Retry
              </Button>
            </Notice>
          )}
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/explore" element={<Navigate to="/build/market" replace />} />
            <Route path="/build/:mode" element={<Builder {...context} />} />
            <Route path="/results" element={<Results {...context} />} />
            <Route path="/findings/:id" element={<Finding result={result} />} />
            <Route path="/saved" element={<Saved setResult={setResult} />} />
            <Route path="/report" element={<Report result={result} />} />
            <Route path="/methodology" element={<Report />} />
            <Route path="/guide" element={<TagGuide />} />
            <Route
              path="*"
              element={
                <Empty
                  title="This page is off the map."
                  text="Start a fresh exploration to find your way back."
                />
              }
            />
          </Routes>
        </main>
        {!landing && (
          <footer className="workspace-footer">
            <Link to="/methodology">Sources and limitations</Link>
          </footer>
        )}
      </div>
    </div></ResultNavigationContext.Provider>
  );
}

function Landing() {
  return (
    <div className="investor-home">
      <section className="investor-hero">
        <div className="investor-hero-copy">
          <p className="eyebrow">FOR YOUR NEXT BUSINESS MOVE</p>
          <h1>Before you sign.<br /><em>Know what to investigate.</em></h1>
          <p>Compare cities, explore relevant places, and turn your business idea into an evidence-backed research shortlist.</p>
          <Link className="button primary" to="/build/market">Start exploring <ArrowRight size={17} /></Link>
          <a className="home-secondary" href="#what-you-get">See what you get <ArrowRight size={15} /></a>
          <div className="home-audience">Opening a café, restaurant, hotel, or shop?</div>
        </div>
        <div className="home-research-preview" aria-label="Illustration of the research process">
          <div className="home-preview-top"><span className="home-preview-dot" /> FROM IDEA TO SHORTLIST <Compass size={18} /></div>
          <div className="home-idea"><span>Your idea</span><h2>A café for readers.<br />A place to start.</h2><div className="home-pills"><span>Coffee</span><span>Reading space</span><span>Remote workers</span></div></div>
          <div className="home-preview-cities"><div><MapPin size={21} /><strong>City A</strong><small>Explore the places</small></div><div><MapPin size={21} /><strong>City B</strong><small>Compare the evidence</small></div></div>
          <div className="home-preview-outcome"><span className="recommendation-icon"><Check size={20} /></span><div><strong>A clearer next step.</strong><small>What to visit. What to verify. What’s still unknown.</small></div></div>
          <span className="home-preview-label">Research workflow illustration</span>
        </div>
      </section>
      <section className="home-problem">
        <span className="eyebrow">LESS GUESSWORK. BETTER QUESTIONS.</span>
        <h2>A location is a commitment.<br />Start with evidence.</h2>
        <p>One promising idea. Several possible locations. Get a structured starting point before the site visits and rent negotiations.</p>
      </section>
      <section id="what-you-get" className="home-services">
        <div className="home-section-heading"><span className="eyebrow">WHAT YOU GET</span><h2>Research that moves you forward.</h2></div>
        <div className="home-service-grid">
          <Link to="/build/market" className="home-service"><MapPin size={26} /><span className="home-service-number">01</span><h3>Compare your cities.</h3><p>Explore relevant places and documented features side by side.</p><span className="text-link">City vs City <ArrowUpRight size={16} /></span></Link>
          <Link to="/build/venue" className="home-service"><Building2 size={26} /><span className="home-service-number">02</span><h3>Learn from existing places.</h3><p>Use reference businesses to investigate related recommendations.</p><span className="text-link">Venue vs Venue <ArrowUpRight size={16} /></span></Link>
          <Link to="/build/concept" className="home-service"><FlaskConical size={26} /><span className="home-service-number">03</span><h3>Explore two directions.</h3><p>Compare interest-led place samples for two ideas in one city.</p><span className="text-link">Concept vs Concept <ArrowUpRight size={16} /></span></Link>
        </div>
      </section>
      <section className="home-evidence">
        <div><span className="eyebrow">REASONS YOU CAN INSPECT</span><h2>Don’t just read a suggestion.<br />See what supports it.</h2></div>
        <ul><li><Check size={18} /><span>Place-linked evidence</span></li><li><Check size={18} /><span>Your requirements, checked against available details</span></li><li><Check size={18} /><span>AI-assisted suggestions when available</span></li><li><Check size={18} /><span>Unknowns and practical next steps</span></li></ul>
        <Link className="text-link" to="/methodology">How the research works <ArrowUpRight size={16} /></Link>
      </section>
      <section className="home-final-cta"><div><span className="eyebrow">BRING YOUR IDEA</span><h2>Leave with a plan to investigate.</h2><p>Choose a scenario or build your own brief.</p></div><Link className="button primary" to="/build/market">Start your research <ArrowRight size={17} /></Link></section>
      <footer className="home-footer"><Link to="/" className="home-wordmark">XenoScope</Link><p>Cultural evidence informs research. It does not predict demand or business success.</p><div><Link to="/guide">Reading the results</Link><Link to="/methodology">Sources & limitations</Link><Link to="/saved">Saved research</Link></div></footer>
    </div>
  );
}

function LiveSearch({ kind, onSelect, selected, label, hint, initialQuery = "" }) {
  const hintId = useId();
  const [query, setQuery] = useState(initialQuery);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  useEffect(() => {
    if (query.trim().length < 2) {
      setItems([]);
      setSearched(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const data = await api(
          `/${kind === "tag" ? "tags" : "entities"}/search?q=${encodeURIComponent(query)}`,
          undefined,
          controller.signal,
        );
        setItems(data.tags || data.entities);
        setSearched(true);
      } catch (e) {
        if (e.name !== "AbortError") setError(e.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, kind]);
  return (
    <div className="search-field">
      <label>
        {label}
        <div className="input-icon">
          <Search size={16} />
          <input
            aria-describedby={hint ? hintId : undefined}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              onSelect(null);
            }}
            placeholder={
              kind === "tag"
                ? "Search interests, e.g. coffee"
                : "Search a venue by name"
            }
            autoComplete="off"
          />
        </div>
      </label>
      {hint && <p id={hintId} className="field-hint">{hint}</p>}
      {selected && (
        <span className="selected-tag">
          <Check size={14} />
          {selected.name}
        </span>
      )}
      {loading && (
        <p className="muted" role="status">
          Searching Qloo…
        </p>
      )}
      {error && <Notice error>{error}</Notice>}
      {!selected && items.length > 0 && (
        <ul className="search-results">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(item);
                  setItems([]);
                }}
              >
                {item.name}
                <small>{item.geography || featureCategory(item)}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
      {searched && !items.length && !selected && !loading && !error && (
        <p className="muted">No matches. Try a more specific term.</p>
      )}
    </div>
  );
}

function Builder({ setResult, result }) {
  const { mode } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const edit =
    location.search.includes("edit=1") && result?.request.mode === mode
      ? result.request
      : null;
  const initial =
    mode === "venue"
      ? ["", ""]
      : mode === "concept"
        ? ["Specialty coffee", "Independent bookshop"]
        : ["Lahore", "Islamabad"];
  const [concept, setConcept] = useState(
    edit?.concept ||
      (mode === "venue" ? "Venue cultural comparison" : "Specialty coffee"),
  );
  const [city, setCity] = useState(edit?.location || "Lahore");
  const [candidates, setCandidates] = useState(
    edit?.candidates || initial.map((label) => ({ label })),
  );
  const [tag, setTag] = useState(
    edit?.interests?.[0] || (edit?.tagId ? { id: edit.tagId, name: edit.tagId } : null),
  );
  const [extraInterests, setExtraInterests] = useState(edit?.interests?.slice(1) || []);
  const [audience, setAudience] = useState(edit?.brief?.audience || "");
  const [features, setFeatures] = useState(edit?.brief?.features.join(", ") || "");
  const [decision, setDecision] = useState(edit?.brief?.decision || "city");
  const [constraints, setConstraints] = useState(edit?.brief?.constraints || "");
  const [referenceVenue, setReferenceVenue] = useState(edit?.referenceVenues?.[0] || edit?.referenceVenue || null);
  const [extraReferences, setExtraReferences] = useState(edit?.referenceVenues?.slice(1) || []);

  const [scenarioId, setScenarioId] = useState("");
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [scenarioMessage, setScenarioMessage] = useState("");
  useEffect(() => {
    const scenario = cityScenarios.find(item => item.id === scenarioId);
    if (!scenario || mode !== "market") return;
    const controller = new AbortController();
    setScenarioLoading(true);
    setScenarioMessage("Finding a live cultural interest and reference business…");
    const queries = scenario.interests || [scenario.interest];
    Promise.allSettled([
      ...queries.map(query => api(`/tags/search?q=${encodeURIComponent(query)}`, undefined, controller.signal)),
      api(`/entities/search?q=${encodeURIComponent(scenario.interest)}`, undefined, controller.signal),
    ]).then(results => {
      if (controller.signal.aborted) return;
      const chosenInterests = [];
      results.slice(0, queries.length).forEach((result, index) => {
        const tags = result.status === "fulfilled" ? result.value.tags || [] : [];
        const eligible = tags.filter(item => item.id?.startsWith("urn:tag:") && item.id.split(":").includes("place"));
        const chosen = eligible.find(item => item.name.toLowerCase() === queries[index].toLowerCase()) || eligible[0];
        if (chosen && !chosenInterests.some(item => item.id === chosen.id)) chosenInterests.push(chosen);
      });
      const chosen = chosenInterests[0];
      const venueResult = results.at(-1);
      const entities = venueResult.status === "fulfilled" ? venueResult.value.entities || [] : [];
      const references = [...new Map(entities.filter(item => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id)).map(item => [item.id.toLowerCase(), { id: item.id, name: item.name }])).values()].slice(0, 3);
      const reference = references[0];
      setTag(chosen || null);
      setReferenceVenue(reference || null);
      setExtraReferences(references.slice(1));
      setExtraInterests(chosenInterests.slice(1));
      setScenarioMessage(`${chosenInterests.length} of 3 distinct live interests and ${references.length} of 3 example reference businesses found. ${chosenInterests.length < 3 || references.length < 3 ? "Some searches had no distinct match; review or add selections manually. " : ""}Review before running.`);
      setScenarioLoading(false);
    });
    return () => controller.abort();
  }, [scenarioId, mode]);

  function applyScenario(id) {
    setScenarioId(id);
    setScenarioMessage("");
    setScenarioLoading(false);
    const scenario = cityScenarios.find(item => item.id === id);
    if (!scenario) return;
    setConcept(scenario.business);
    setAudience(scenario.audience);
    setFeatures(scenario.features);
    setCandidates([{ label: "" }, { label: "" }]);
    setConstraints(scenario.constraints);
    setDecision("city");
    setReferenceVenue(null);
    setExtraReferences([]);
    setExtraInterests([]);
    setTag(null);
    setResearch(false);
    setError("");
  }
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!loading) return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [loading]);
  const progressLabel = elapsed < 2 ? "Sending request…" : elapsed < 15 ? "Waiting for Qloo…" : "Still waiting for results…";
  const [research, setResearch] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setCandidates(edit?.candidates || initial.map((label) => ({ label })));
    setTag(edit?.interests?.[0] || (edit?.tagId ? { id: edit.tagId, name: edit.tagId } : null));
    setError("");
    setConcept(edit?.concept || (mode === "venue" ? "Venue cultural comparison" : "Specialty coffee"));
    setCity(edit?.location || "Lahore");
  }, [mode]);
  if (!modes.some((m) => m.id === mode))
    return <Empty title="Choose an exploration mode." />;
  function updateCandidate(index, value) {
    setCandidates((prev) => prev.map((c, i) => (i === index ? value : c)));
  }
  async function submit(event) {
    event.preventDefault();
    setError("");
    const parsed = requestSchema.safeParse({
      mode,
      source: "live",
      concept,
      location: mode === "concept" ? city : undefined,
      candidates,
      tagId: tag?.id,
      interests: mode === "market" ? [tag, ...extraInterests].filter(Boolean) : undefined,
      referenceVenue: referenceVenue || undefined,
      referenceVenues: [referenceVenue, ...extraReferences].filter(Boolean),
      brief: { audience, features: features.split(",").map(value => value.trim()).filter(Boolean), decision: mode === "market" ? "city" : decision, constraints },
    });
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join(" "));
      return;
    }
    if (loading || scenarioLoading) return;
    setElapsed(0);
    setLoading(true);
    try {
      const data = await api(research ? "/research" : "/compare", parsed.data);
      setResult(data);
      navigate("/results");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="builder-page">
      <Link to="/" className="back-link"><ChevronLeft size={16} /> Back to home</Link>
      {mode === "market" && <section className="scenario-picker">
        <label htmlFor="city-scenario">Try a scenario</label>
        <select id="city-scenario" value={scenarioId} disabled={loading} onChange={e => applyScenario(e.target.value)}>
          <option value="">Choose an example to fill the form</option>
          {cityScenarios.map(scenario => <option key={scenario.id} value={scenario.id}>{scenario.name}</option>)}
        </select>
        <p className="field-hint">Examples fill the brief and leave both cities for you to enter, then select a live place-related interest and example reference business. References are search examples, not endorsements. Budgets are illustrative. Review and edit before running.</p>
        {scenarioMessage && <p role="status" className="field-hint">{scenarioMessage}</p>}
      </section>}
      <Title
        eyebrow="02 / BUILD YOUR COMPARISON"
        title={modes.find((m) => m.id === mode).name}
      >
        Choose two options and a cultural interest.
      </Title>
      <div className="builder-layout">
        <form className="panel builder" onSubmit={submit}>
          <div className="section-head">
            <h2>Your comparison</h2>
            <Source source="live" />
          </div>
          <p className="field-hint">
            Choose an interest or a place from the search results.
          </p>
          {mode !== "venue" && (
            <label className="field">
              {mode === "concept" ? "Exploration question" : "Business concept"}
              <input
                aria-describedby="concept-help"
                required
                minLength={2}
                maxLength={100}
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
              />
            </label>
          )}
          {mode !== "venue" && <div id="concept-help" className="field-hint input-help">
            <p>{mode === "market" ? "Describe the business you want to explore in both cities. Include what you plan to offer and who it is for. Keep it to a short phrase (2–100 characters)." : "Write the question you want to investigate about the two concepts in your chosen city (2–100 characters)."}</p>
            <p><strong>Example:</strong> {mode === "market" ? "A specialty coffee shop with a reading space for students and remote workers." : "Should I explore a specialty coffee shop or an independent bookshop in Lahore?"}</p>
            <p>This describes your research. The interest you select below determines the cultural data retrieved.</p>
          </div>}
          <fieldset className="business-brief">
            <legend>Your business brief</legend>
            <label>Who is it for?<input maxLength={300} value={audience} onChange={e => setAudience(e.target.value)} placeholder="Students and remote workers" /></label>
            <label>Required features<input value={features} onChange={e => setFeatures(e.target.value)} placeholder="Wi-Fi, quiet seating, reading space" aria-describedby="features-help" /></label>
            <p id="features-help" className="field-hint">Separate up to 12 features with commas. We check matching feature labels and flag anything unverified; this does not add new Qloo search filters.</p>
            {mode === "market" ? <p className="field-hint"><strong>Your decision:</strong> Which of these two cities to investigate for your business. Neighborhood and property selection require a separate local study.</p> : <label>What are you deciding?<select value={decision} onChange={e => setDecision(e.target.value)}><option value="city">Which city to investigate</option><option value="concept">Which business concept to investigate</option></select></label>}
            <label>Budget and other constraints<textarea rows={3} maxLength={500} value={constraints} onChange={e => setConstraints(e.target.value)} placeholder="Monthly rent budget, seating capacity, opening hours…" /></label>
          </fieldset>
          {mode === "concept" && (
            <label className="field">
              Shared location
              <input
                required
                minLength={2}
                maxLength={100}
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </label>
          )}
          {mode === "market" && <p className="field-hint">Search worldwide cities by name, state, or country. Suggestions depend on the installed city dataset; Qloo coverage can differ. You can also enter a city manually.</p>}
          <div className="candidate-inputs">
            {candidates.map((candidate, i) => (
              <div className={`candidate-input candidate-${i}`} key={i}>
                <div className="section-head">
                  <span className="eyebrow">
                    {mode === "market" ? "City" : mode === "venue" ? "Venue" : "Concept"} {i === 0 ? "A" : "B"}
                  </span>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove candidate ${i === 0 ? "A" : "B"}`}
                    onClick={() => updateCandidate(i, { label: "" })}
                  >
                    <X size={16} />
                  </button>
                </div>
                {mode === "venue" ? (
                  <LiveSearch
                    label={`Venue ${i === 0 ? "A" : "B"}`}
                    kind="entity"
                    selected={
                      candidate.entityId ? { name: candidate.label } : null
                    }
                    onSelect={(item) =>
                      updateCandidate(
                        i,
                        item
                          ? { label: item.name, entityId: item.id }
                          : { label: "" },
                      )
                    }
                  />
                ) : mode === "market" ? (
                  <CitySearch label={`City ${i === 0 ? "A" : "B"}`} value={candidate.label} onChange={value => updateCandidate(i, { label: value })} />
                ) : (
                  <label>
                    Concept
                    <input
                      required
                      minLength={2}
                      maxLength={100}
                      list={mode === "market" ? "city-suggestions" : undefined}
                      className={mode === "market" && !candidate.label ? "city-required" : ""}
                      value={candidate.label}
                      onChange={(e) =>
                        updateCandidate(i, { label: e.target.value })
                      }
                      placeholder={
                        mode === "market" ? "Enter your city" : "Concept label"
                      }
                    />
                  </label>
                )}
                {mode === "concept" && (
                  <LiveSearch
                    kind="tag"
                    label={`Interest for concept ${i === 0 ? "A" : "B"}`}
                    selected={
                      candidate.tagId ? { name: candidate.label } : null
                    }
                    onSelect={(item) =>
                      updateCandidate(
                        i,
                        item
                          ? { label: item.name, tagId: item.id }
                          : { label: candidate.label },
                      )
                    }
                  />
                )}
              </div>
            ))}
          </div>
          {mode === "market" && <div className="reference-venue">
            <LiveSearch kind="entity" label="Reference business (optional)" selected={null} onSelect={item => {
              if (!item) return;
              if (!referenceVenue) setReferenceVenue(item);
              else if (item.id !== referenceVenue.id && !extraReferences.some(reference => reference.id === item.id) && extraReferences.length < 2) setExtraReferences([...extraReferences, item]);
            }} hint="You can select up to 3 reference businesses. They guide the style of recommendations in both cities, not measured demand." />
            <div className="tag-list">{[referenceVenue, ...extraReferences].filter(Boolean).map(reference => <button type="button" className="button small" key={reference.id} aria-label={`Remove reference ${reference.name}`} onClick={() => {
              const remaining = [referenceVenue, ...extraReferences].filter(item => item && item.id !== reference.id);
              setReferenceVenue(remaining[0] || null); setExtraReferences(remaining.slice(1));
            }}>{reference.name} <X size={14} /></button>)}</div>

          </div>}
          {mode === "market" && (
            <>
              <LiveSearch
                kind="tag"
                label="Cultural interest"
                key={scenarioId}
                hint="You can select up to 3 cultural interests (our app’s request limit, not a Qloo-wide limit). Results include places matching any selected interest, not necessarily all. Each interest adds one live request per city. Search for a cultural interest related to your business, then select a matching result. For a coffee shop, type coffee and choose Coffee in a place-related category. Typing alone does not select an interest. The same interest is used for both markets; results depend on Qloo’s coverage."
                selected={null}
                onSelect={item => {
                  if (!item) return;
                  if (!tag) setTag(item);
                  else if (item.id !== tag.id && !extraInterests.some(interest => interest.id === item.id) && extraInterests.length < 2) setExtraInterests([...extraInterests, item]);
                }}
              />
              <div className="tag-list">{[tag, ...extraInterests].filter(Boolean).map(interest => <button type="button" className="button small" key={interest.id} aria-label={`Remove interest ${interest.name}`} onClick={() => {
                const remaining = [tag, ...extraInterests].filter(item => item && item.id !== interest.id);
                setTag(remaining[0] || null); setExtraInterests(remaining.slice(1));
              }}>{interest.name} <X size={14} /></button>)}</div>


            </>
          )}
          {mode === "venue" && (
            <p className="field-hint">
              Compare recommended places surrounding each selected venue’s
              cultural signal.
            </p>
          )}
          {error && (
            <Notice error>
              {error}
            </Notice>
          )}
          {mode !== "market" && <label className="research-toggle"><input type="checkbox" checked={research} onChange={e => setResearch(e.target.checked)} /> <span>Investigate coverage and suggest a next step</span></label>}
          <div className="form-bottom">
            <div className="comparison-progress" role="status" aria-live="polite" aria-atomic="true">
              {loading ? <>
                <span>{elapsed < 2 ? "Starting your comparison." : elapsed < 15 ? "Request sent. Waiting for Qloo’s response." : "Qloo has not returned results yet. You can keep this page open."}</span>
                <small aria-hidden="true">{elapsed}s elapsed</small>
              </> : <span>Compare cultural signals.</span>}
            </div>
            <Button className="primary" disabled={loading || scenarioLoading} aria-busy={loading || scenarioLoading} type="submit">
              {loading ? (
                <>
                  <LoaderCircle className="spin" size={17} /> {progressLabel}
                </>
              ) : (
                <>
                  {scenarioLoading ? "Preparing scenario…" : "Run comparison"} <ArrowRight size={17} />
                </>
              )}
            </Button>
          </div>
        </form>

      </div>
    </div>
  );
}

function Empty({
  title = "Your next question starts here.",
  text = "Run a comparison to see the evidence in this view.",
}) {
  return (
    <div className="empty-page">
      <div className="icon-box">
        <Compass size={32} />
      </div>
      <h1>{title}</h1>
      <p>{text}</p>
      <Link to="/build/market" className="button primary">
        Start exploring <ArrowRight size={16} />
      </Link>
    </div>
  );
}

export function Results({ result, setResult, config }) {
  const [pageLoading, setPageLoading] = useState(false);
  const [pageError, setPageError] = useState("");
  async function loadQlooPage(page) {
    if (!setResult || pageLoading) return;
    setPageLoading(true); setPageError("");
    try { setResult(await api("/places/page", { ...result.request, page })); }
    catch (e) { setPageError(e.message); }
    finally { setPageLoading(false); }
  }
  const [differences, setDifferences] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("difference");
  const [page, setPage] = useState(1);
  const [presence, setPresence] = useState("");
  const [minimum, setMinimum] = useState(0);
  const [gap, setGap] = useState(0);
  useEffect(() => { setPage(1); }, [query, category, sort, differences, presence, minimum, gap, result?.id]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const analysis = useMemo(
    () => (result ? compareCandidates(result.candidates) : null),
    [result],
  );
  useEffect(() => {
    setSaved(false);
    setQuery("");
    setCategory("");
    setDifferences(false);
    setPresence(""); setMinimum(0); setGap(0);
  }, [result?.id]);
  if (!result) return <Empty />;
  if (result.candidates.every(candidate => candidate.entities.length === 0) && (result.paging?.page || 1) === 1) return (
    <section className="panel research-brief">
      <h1>No places matched this comparison</h1>
      <p>Qloo responded, but returned no places for either {result.candidates[0].label} or {result.candidates[1].label} with your selected interest.</p>
      <p>Try another place-related interest or a more specific city name, including its country. An empty response can reflect coverage or filter compatibility; it does not mean the cities have no interest in your concept.</p>
      <Link className="button primary" to={`/build/${result.request.mode}?edit=1`}>Edit comparison <ArrowRight size={16} /></Link>
      {result.research?.alternatives.length > 0 && <p>Alternative interests to search: {result.research.alternatives.map(tag => tag.name).join(", ")}</p>}
      <details><summary>Request details</summary>{result.candidates.map(candidate => <div key={candidate.label}><h2>{candidate.label}</h2><pre>{JSON.stringify(candidate.provenance.query || {}, null, 2)}</pre></div>)}</details>
    </section>
  );
  const rows = filterRows(analysis.rows, {
    differences,
    query,
    category,
    sort,
  }).filter(row =>
    (!presence || (presence === "shared" ? row.shared : presence === "a" ? row.a > 0 && row.b === 0 : row.b > 0 && row.a === 0)) &&
    Math.max(row.a, row.b) >= minimum && Math.abs(row.delta) >= gap
  );
  const recommendation = decisionBrief(result);
  const pageCount = Math.max(1, Math.ceil(rows.length / 10));
  const currentPage = Math.min(page, pageCount);
  const pageRows = rows.slice((currentPage - 1) * 10, currentPage * 10);
  return (
    <div className="results-layout">
      <ResultsOutline hasAI={result.ai?.status === "ready"} hasResearch={Boolean(result.research)} />
      <div className="results-content">
      <div className="breadcrumb">
        RESEARCH <span>/</span> {result.request.mode === "market" ? "CITY VS CITY" : result.request.mode.toUpperCase()}{" "}
        COMPARISON
      </div>
      <div className="results-title">
        <Title eyebrow="03 / READ THE SIGNALS" title={result.request.concept}>
          A side-by-side view of cultural connections.
        </Title>
        <div className="actions">
          <Button
            onClick={() => {
              try {
                saveResult(result);
                setSaved(true);
                setError("");
              } catch {
                setError(
                  "Browser storage is unavailable or full. Export your report instead.",
                );
              }
            }}
          >
            {saved ? <Check size={16} /> : <Bookmark size={16} />}{" "}
            {saved ? "Saved locally" : "Save exploration"}
          </Button>
          <Link className="button" to="/saved">Saved explorations</Link>
          <Link className="button primary" to="/report">
            <Download size={16} /> Export report
          </Link>
        </div>
      </div>
      {error && <Notice error>{error}</Notice>}
      <div className="result-meta">
        <Source source={result.source} />
        <span>
          Source: Qloo API
        </span>
        <span>Retrieved {new Date(result.createdAt).toLocaleString()}</span>
        <Link to={`/build/${result.request.mode}?edit=1`} className="text-link">
          <SlidersHorizontal size={14} /> Edit comparison
        </Link>
      </div>
      <p className="comparison-received" role="status">{result.candidates.some(candidate => candidate.entities.length === 0) ? "Qloo returned results for only one option. This comparison has incomplete coverage." : "Qloo response received. Your comparison is ready."}</p>

      <section id="decision" className="panel decision-brief">
        <div className="decision-heading"><span className="recommendation-icon"><Compass size={24} /></span><div><span className="eyebrow">YOUR RESEARCH SHORTLIST</span><h2>Your next move</h2></div></div>
        <p className="decision-recommendation">{recommendation.recommendation}</p>
        <div className="outcome-badges"><span className="badge teal">Qloo evidence</span><span className="badge">Site visits next</span><span className="badge">Demand unverified</span></div>
        <div className="outcome-snapshots">{recommendation.cityEvidence.map(city => <article key={city.label}><span className="eyebrow">{city.label}</span><strong>{city.sampleSize}<small>returned places</small></strong><span>{recommendation.requirements.length ? `${city.documentedRequirements} / ${recommendation.requirements.length} requested features documented` : "Add requirements to check feature matches"}</span><div className="outcome-badges">{city.shortlist.slice(0, 2).map(place => <Link key={place.id} className="badge" to={`/findings/${encodeURIComponent(place.id)}`}>{place.name} ↗</Link>)}</div></article>)}</div>
        {result.request.brief?.audience && <p className="field-hint">Your target audience: {result.request.brief.audience} · supplied in your brief.</p>}
        <details className="brief-details"><summary>How your requirements compare</summary>
        {recommendation.requirements.length ? recommendation.requirements.map(row => <div className="requirement-row" key={row.feature}>
          <strong>{row.feature}</strong>
          {row.matches.map((matches, i) => <div key={i}><span>{result.candidates[i].label}: </span>{matches.length ? <><span>{matches.length} returned places with a matching feature label. </span>{matches.slice(0, 3).map(place => <Link className="evidence-link" key={place.id} to={`/findings/${encodeURIComponent(place.id)}`}>{place.name}</Link>)}</> : <span>Not verified in this sample; check during a visit.</span>}</div>)}
        </div>) : <p>Add required features in <Link to={`/build/${result.request.mode}?edit=1`}>your brief</Link> to check them against returned place information.</p>}
        <p className="field-hint">Matches use exact feature labels with punctuation ignored. Similar wording may be missed. Missing metadata does not mean a facility is absent.</p>
        </details><details className="brief-details"><summary>Suggested places and supporting evidence</summary>
        <p>Shortlists prioritize explicit feature matches, then alphabetical order. They are examples from the returned sample, not a complete competitor list or a commercial ranking.</p>
        <div className="city-evidence-grid">{recommendation.cityEvidence.map(city => <section key={city.label}>
          <h3>{city.label}</h3><p>{city.sampleSize} places returned · {city.documentedRequirements} of {recommendation.requirements.length} requirements have matching labels.</p>
          {city.shortlist.map(place => <article className="requirement-row" key={place.id}>
            <Link className="evidence-link" to={`/findings/${encodeURIComponent(place.id)}`}>{place.name}</Link>
            {place.website && <a className="evidence-link" href={place.website} target="_blank" rel="noreferrer">Business website</a>}
            <p>{place.matchedFeatures.length ? `Matching features: ${place.matchedFeatures.join(", ")}` : "No requested features verified; inspect the place details."}</p>
            {place.description && <p>{place.description.slice(0, 240)}</p>}
          </article>)}
          <details><summary>Common features in this sample</summary><ul>{city.commonFeatures.map(feature => <li key={feature.id}><Link to={`/findings/${encodeURIComponent(feature.id)}`}>{feature.name}</Link>: {feature.count} returned places</li>)}</ul></details>
        </section>)}</div>
        </details><h3>Your action plan</h3><div className="outcome-actions">{recommendation.nextSteps.slice(0, 3).map((step, i) => <article key={step}><span className="outcome-step">0{i + 1}</span><strong>{["Talk to customers", "Visit the shortlist", "Check the costs"][i]}</strong><p>{step}</p></article>)}</div>
        <details><summary>What remains unknown</summary><ul>{recommendation.unknowns.map(item => <li key={item}>{item}</li>)}</ul></details>
      </section>

      {result.ai?.status === "ready" && <section id="ai-brief" className="panel decision-brief">
        <h2>Insights to act on</h2><p className="decision-recommendation">{result.ai.headline}</p>
        <p>Suggestions based on a small selection of returned Qloo places. Verify before committing.</p>
        <ul>{result.ai.findings?.map((finding, i) => <li key={i}>{finding.text}<div>{finding.evidenceIds.map(id => <Link className="evidence-link" key={id} to={`/findings/${encodeURIComponent(id)}`}>{result.candidates.flatMap(c => c.entities).find(e => e.id === id)?.name || "Inspect evidence"}</Link>)}</div></li>)}</ul>
        <details><summary>Risks and missing information</summary><ul>{result.ai.risks?.map(risk => <li key={risk}>{risk}</li>)}</ul></details>
        <h3>Suggested actions</h3><ol>{result.ai.nextSteps?.map(step => <li key={step}>{step}</li>)}</ol>
        <details><summary>AI usage</summary><p>{result.ai.model} · {result.ai.inputTokens} input tokens · {result.ai.outputTokens} output tokens {result.ai.cached ? "· reused cached brief; no new AI call" : "· one AI call"}</p></details>
      </section>}
      {result.ai?.status === "unavailable" && <Notice>AI summary unavailable: {result.ai.reason} The source evidence below is still available.</Notice>}
      {result?.research && <section id="research-activity" className="panel research-brief">
        <h2>Research activity</h2>
        <div className="outcome-badges">{result.research.trace.map((step, i) => <span className="badge" key={i}>{step.action}</span>)}</div>
        {result.research.evidence.map(e => <p key={e.id}><Link to={`/findings/${encodeURIComponent(e.id)}`}>{e.name}</Link> ({e.counts.join(" / ")} returned places)</p>)}
        <details><summary>See research tool activity</summary><p>{result.research.nextStep}</p><ol>{result.research.trace.map(t => <li key={t.action}><strong>{t.action}</strong>: {t.detail}</li>)}</ol>
        {result.research.alternatives.length > 0 && <p>Alternative interests: {result.research.alternatives.map(t => t.name).join(", ")}</p>}
        <p>{result.research.caveat}</p></details>
      </section>}

      <ResearchAssistant key={result.id} result={result} configured={config?.assistantConfigured} />

      <div id="cities" className="comparison-candidates">
        {result.candidates.map((candidate, i) => (
          <section className={`candidate-panel candidate-${i}`} key={i}>
            <div className="section-head">
              <MapPin size={18} />
            </div>
            <h2>{candidate.label}</h2>
            <p>
              {result.request.mode === "concept"
                ? result.request.location
                : result.request.mode === "venue"
                  ? "Venue cultural exploration"
                  : "Market"}
            </p>
            <div className="candidate-stats">
              <div>
                <strong>{candidate.entities.length}</strong>
                <span>returned entities</span>
              </div>
              <div>
                <strong>
                  {analysis.coverage[i].tagged}/{candidate.entities.length}
                </strong>
                <span>places with details</span>
              </div>
              <div>
                <strong>
                  {
                    new Set(
                      candidate.entities.flatMap((e) =>
                        e.tags.map((t) => t.id),
                      ),
                    ).size
                  }
                </strong>
                <span>interests and features</span>
              </div>
            </div>
          </section>
        ))}
        <span className="center-vs">VS</span>
      </div>
      <section id="places" className="panel entity-section">
        <div className="section-head"><h2>Places to investigate</h2><span className="muted">Qloo page {result.paging?.page || 1}</span></div>
        <p>Each Qloo page returns up to 50 places per interest in each city. Duplicate places are combined. Counts and charts describe this page, not the full market.</p>
        <div className="entity-columns">{result.candidates.map((candidate, i) => <PlaceBrowser key={`${result.id}-${i}`} candidate={candidate} />)}</div>
        {result.paging && <nav className="pagination" aria-label="Qloo result pages">
          <Button disabled={pageLoading || result.paging.page <= 1} onClick={() => loadQlooPage(result.paging.page - 1)}>Previous Qloo page</Button>
          <span role="status">{pageLoading ? "Fetching more places from Qloo…" : `Qloo page ${result.paging.page}`}</span>
          <Button disabled={pageLoading || !result.paging.hasMore} onClick={() => loadQlooPage(result.paging.page + 1)}>Load next Qloo page</Button>
        </nav>}
        {pageError && <Notice error>{pageError}</Notice>}
      </section>
      <section className="insight-strip">
        <Sparkles size={22} />
        <div>
          <span className="eyebrow">WHAT THE RETURNED DATA SHOWS</span>
          <p>{analysis.summary}</p>
        </div>
      </section>
      <div className="results-grid">
        <section id="comparison" className="panel signal-panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">CULTURAL CONNECTIONS</p>
              <h2>Compare what matters</h2>
            </div>
            <span className="count-label">{rows.length} features</span>
          </div>
          <p className="muted">
            Number of returned places with each interest or feature. No demand
            score. <Link className="text-link" to="/guide">How to read these results</Link>
          </p>
          <div className="filters">
            <div className="input-icon">
              <Search size={15} />
              <input
                aria-label="Filter signals"
                placeholder="Find an interest or feature…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <select
              aria-label="Filter category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {[...new Set(analysis.rows.map((r) => r.category))].map((c) => (
                <option key={c} value={c}>{readableLabel(c)}</option>
              ))}
            </select>
            <select
              aria-label="Sort signals"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="difference">Biggest count difference</option>
              <option value="name">Name A–Z</option>
              <option value="a">Candidate A count</option>
              <option value="b">Candidate B count</option>
            </select>
          </div>
          <div className="custom-filters">
            <label>Appears in<select value={presence} onChange={e => setPresence(e.target.value)}><option value="">Either option</option><option value="shared">Both options</option><option value="a">{result.candidates[0].label} only</option><option value="b">{result.candidates[1].label} only</option></select></label>
            <label>Minimum place count<input type="number" min="0" max="150" value={minimum} onChange={e => setMinimum(Math.min(150, Math.max(0, Number(e.target.value))))} /></label>
            <label>Minimum count difference<input type="number" min="0" max="150" value={gap} onChange={e => setGap(Math.min(150, Math.max(0, Number(e.target.value))))} /></label>
          </div>
          <div className="filter-meta">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={differences}
                onChange={(e) => setDifferences(e.target.checked)}
              />{" "}
              Show differences only
            </label>
            <button
              className="text-button"
              onClick={() => {
                setDifferences(false);
                setQuery("");
                setCategory("");
                setSort("difference");
                setPresence(""); setMinimum(0); setGap(0);
              }}
            >
              Reset filters
            </button>
          </div>
          <div className="chart-legend">
            <span>
              <i /> {result.candidates[0].label}
            </span>
            <span>
              <i /> {result.candidates[1].label}
            </span>
          </div>
          <Suspense fallback={<p role="status">Loading chart…</p>}>
            <SignalChart
              rows={pageRows}
              labels={result.candidates.map((c) => c.label)}
            />
          </Suspense>
          <div id="evidence" className="table-scroll">
            <table>
              <caption className="sr-only">
                Cultural tag counts in returned entities, accessible alternative
                to the chart
              </caption>
              <thead>
                <tr>
                  <th>Interest or feature</th>
                  <th>{result.candidates[0].label}</th>
                  <th>{result.candidates[1].label}</th>
                  <th>Evidence</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link to={`/findings/${encodeURIComponent(row.id)}`}>
                        {row.name}
                      </Link>
                      <small className="feature-badge">{featureCategory(row)}</small>
                    </td>
                    <td className="cyan">{row.a || "Not returned"}</td>
                    <td className="violet">{row.b || "Not returned"}</td>
                    <td>
                      <Link
                        to={`/findings/${encodeURIComponent(row.id)}`}
                        aria-label={`Inspect ${row.name}`}
                      >
                        <ArrowUpRight size={17} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 0 && <nav className="pagination" aria-label="Signal table pagination">
            <Button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</Button>
            <span role="status">{(currentPage - 1) * 10 + 1}–{Math.min(currentPage * 10, rows.length)} of {rows.length} · Page {currentPage} of {pageCount}</span>
            <Button disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next</Button>
          </nav>}
          {!rows.length && (
            <p className="empty">
              No interests or features match these filters. Reset filters to see all available
              signals.
            </p>
          )}
          <p className="source-note">
            Source: Qloo /v2/insights.{" "}
            Computed by counting interests and features per returned entity.
          </p>
        </section>
        <aside className="result-aside">
          <section className="panel">
            <div className="section-head">
              <h3>Evidence coverage</h3>
              <Info size={17} />
            </div>
            {analysis.coverage.map((c, i) => (
              <div className="coverage" key={i}>
                <strong>{result.candidates[i].label}</strong>
                <div className="coverage-bar">
                  <span
                    style={{
                      width: `${c.total ? (c.tagged / c.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <p>
                  {c.tagged} of {c.total} places have feature details
                </p>
                <p>{c.geography} have geographic metadata</p>
              </div>
            ))}
            <p className="small-print">
              Metadata completeness in this response, not coverage of the whole
              market.
            </p>
          </section>
          <section className="panel next-questions">
            <span className="eyebrow">TAKE IT INTO THE REAL WORLD</span>
            <h3>What to validate next</h3>
            <ul>
              {questions.slice(0, 3).map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
            <Link className="text-link" to="/report">
              Read full methodology <ArrowRight size={15} />
            </Link>
          </section>
        </aside>
      </div>
      <InvestorChecklist key={result.id} />
      <Notice>
        {limitations[0]} Demographic, heatmap, and trend data are not returned
        by this comparison. <Link to="/report">Inspect methodology</Link>.
      </Notice>
    </div></div>
  );
}

export function Finding({ result }) {
  const { id } = useParams();
  if (!result)
    return <Empty title="Open a comparison to inspect its findings." />;
  const analysis = compareCandidates(result.candidates);
  const tag = analysis.rows.find((t) => t.id === id);
  const entity = result.candidates
    .flatMap((c) => c.entities)
    .find((e) => e.id === id);
  if (!tag && !entity)
    return <Empty title="This finding is not in the current comparison." />;
  const item = tag || entity;
  return (
    <>
      <Link className="back-link" to="/results">
        <ChevronLeft size={16} /> Back to comparison
      </Link>
      <Title eyebrow="EVIDENCE / FINDING DETAIL" title={item.name}>
        Inspect the source before interpreting the signal.
      </Title>
      {entity && <FindingExtras result={result} entity={entity} />}
      <div className="detail-layout">
        <section className="panel">
          <Source source={result.source} />
          {tag && <span className="feature-badge">{featureCategory(tag)}</span>}
          <h2>
            {tag
              ? "An interest or place feature"
              : "A returned place"}
          </h2>
          <p>
            {tag
              ? "The places below carry this feature. Counts describe these returned places only."
              : entity.description ||
                "No description was returned by the source."}
          </p>
          <details><summary>Technical source details</summary><div className="source-id">Source ID: {id}</div></details>
          {result.candidates.map((c, i) => {
            const evidence = c.entities.filter((e) =>
              tag ? e.tags.some((t) => t.id === id) : e.id === id,
            );
            return (
              <div className="evidence-group" key={i}>
                <h3>
                  {c.label}{" "}
                  <span className="muted">
                    / {evidence.length}{" "}
                    {tag ? "places with this feature" : "matching places"}
                  </span>
                </h3>
                {evidence.length ? (
                  evidence.map((e) => (
                    <div className="evidence-item" key={e.id}>
                      <strong>{e.name}</strong>
                      <p>
                        {e.tags.map((t) => t.name).join(" · ") ||
                          "Feature details unavailable"}
                      </p>
                      {e.website && <a className="evidence-link" href={e.website} target="_blank" rel="noreferrer">Business website</a>}
                      {e.address && <p>{e.address}</p>}
                      {e.explanation && <details><summary>Qloo recommendation explanation</summary><pre>{e.explanation}</pre></details>}
                      {!tag && (
                        <p>
                          Affinity: {e.affinity ?? "Unavailable"} · Popularity:{" "}
                          {e.popularity ?? "Unavailable"} · Geography:{" "}
                          {e.geography ?? "Unavailable"}
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="muted">
                    Not returned for this candidate. This does not establish
                    absence.
                  </p>
                )}
                <details>
                  <summary>Source and query metadata</summary>
                  <pre>{JSON.stringify(c.provenance, null, 2)}</pre>
                </details>
              </div>
            );
          })}
        </section>
        <aside className="panel">
          <h3>How to read this finding</h3>
          <p>
            {tag?.shared
              ? "This feature appears among returned places on both sides."
              : tag
                ? "This feature appears on only one side of the returned sample. Explore why before drawing conclusions."
                : "This entity is evidence returned for the query. Its inclusion is not a business recommendation."}
          </p>
          <Notice>{limitations[0]}</Notice>
          <h3>Related interests and features</h3>
          <div className="tag-list">
            {(entity?.tags || []).map((t) => (
              <Link to={`/findings/${encodeURIComponent(t.id)}`} key={t.id}>
                {t.name} <span className="feature-badge">{featureCategory(t)}</span>
              </Link>
            ))}
          </div>
          {!entity && (
            <p className="muted">
              Related tags are visible on each evidence entity; no extra
              associations are inferred.
            </p>
          )}
        </aside>
      </div>
    </>
  );
}

function Saved({ setResult }) {
  const [saved, setSaved] = useState(readSaved);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  return (
    <>
      <Title eyebrow="YOUR RESEARCH, WITHIN REACH" title="Saved explorations">
        Stored in this browser only. They are not synced to an account or other
        devices.
      </Title>
      {error && <Notice error>{error}</Notice>}
      {saved.length ? (
        <div className="saved-grid">
          {saved.map((r) => (
            <article className="panel saved-card" key={r.id}>
              <div className="section-head">
                <Source source={r.source} />
                <Button
                  aria-label={`Delete ${r.request.concept}`}
                  onClick={() => {
                    try {
                      deleteSaved(r.id);
                      setSaved(readSaved());
                    } catch {
                      setError("Could not update browser storage.");
                    }
                  }}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
              <h2>{r.request.concept}</h2>
              <p>{r.candidates.map((c) => c.label).join(" ↔ ")}</p>
              <small className="muted">
                {new Date(r.createdAt).toLocaleString()}
              </small>
              <Button
                className="full"
                onClick={() => {
                  setResult(r);
                  navigate("/results");
                }}
              >
                Reopen exploration <ArrowRight size={16} />
              </Button>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="Room for your next discovery."
          text="Save a comparison to return to its evidence later. Browser data can be cleared, so export important reports."
        />
      )}
    </>
  );
}

function Report({ result }) {
  const [error, setError] = useState("");
  const report = result ? buildReport(result) : null;
  async function exportReport(format) {
    try {
      setError("");
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result, format }),
      });
      if (!response.ok) {
        let data = await response.json();
        throw new Error(data.error?.message || "Export failed.");
      }
      download(
        format === "csv"
          ? await response.text()
          : JSON.stringify(await response.json(), null, 2),
        format,
      );
    } catch (e) {
      setError(e.message || "Export failed. Please retry.");
    }
  }
  return (
    <div className="report">
      <div className="results-title">
        <Title
          eyebrow="TRANSPARENT BY DESIGN"
          title={
            result ? "Your exploration report" : "The method behind the lens"
          }
        >
          {result
            ? `${result.request.concept} · ${result.candidates.map((c) => c.label).join(" vs ")}`
            : "Evidence you can inspect. Calculations you can understand."}
        </Title>
        <div className="actions no-print">
          {result && (
            <>
              <Button onClick={() => exportReport("json")}>
                <Download size={16} /> JSON
              </Button>
              <Button onClick={() => exportReport("csv")}>
                <Download size={16} /> CSV
              </Button>
            </>
          )}
          <Button onClick={() => window.print()}>
            <FileText size={16} /> Print / PDF
          </Button>
        </div>
      </div>
      {error && <Notice error>{error}</Notice>}
      {result && (
        <>
          <div className="report-meta">
            <Source source={result.source} />
            <span>{new Date(result.createdAt).toLocaleString()}</span>
          </div>
          <section className="panel">
            <h2>The comparison</h2>
            <p>{report.analysis.summary}</p>
            <h3>Selected assumptions</h3>
            <p>
              Mode: {result.request.mode} · Concept: {result.request.concept}
              {result.request.location
                ? ` · Location: ${result.request.location}`
                : ""}
            </p>
            <p>
              Both result sets use the same entity category. Live comparisons
              request up to 50 places per interest per city page. Counts refer only to
              returned entities.
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Returned cultural tag</th>
                    {result.candidates.map((c, i) => (
                      <th key={i}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.analysis.rows.map((t) => (
                    <tr key={t.id}>
                      <td>{t.name}</td>
                      <td>{t.a || "Not returned"}</td>
                      <td>{t.b || "Not returned"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel">
            <h2>Coverage & provenance</h2>
            {result.candidates.map((c, i) => (
              <div key={i}>
                <h3>{c.label}</h3>
                <p>
                  {report.analysis.coverage[i].tagged} / {c.entities.length}{" "}
                  entities have cultural tags.{" "}
                  {report.analysis.coverage[i].geography} have geographic
                  metadata.
                </p>
                <p>
                  {c.provenance.provider} · {c.provenance.endpoint} · Retrieved{" "}
                  {c.provenance.retrievedAt}
                </p>
                <pre>{JSON.stringify(c.provenance.query || {}, null, 2)}</pre>
              </div>
            ))}
            <p>{report.attribution}</p>
          </section>
        </>
      )}
      <section className="panel">
        <h2>How comparisons are calculated</h2>
        <ol className="method-list">
          <li>
            <strong>Resolve the question.</strong> Live market mode uses a
            user-selected Qloo tag plus an exact city-name filter. Live venue
            mode uses each selected venue’s ID as the interest signal for place
            recommendations.
          </li>
          <li>
            <strong>Normalize the response.</strong> Entities and tags are
            deduplicated by case-insensitive source ID. Missing numerical values
            stay null.
          </li>
          <li>
            <strong>Align the evidence.</strong> Tag counts measure how many
            returned entities contain each tag, once per entity. The difference
            is A count minus B count. “Differences only” shows tags returned on
            just one side.
          </li>
          <li>
            <strong>Keep scales separate.</strong> We do not compare popularity
            with affinity, average incompatible values, or compute a market
            success score. Cross-query affinity scores are not ranked.
          </li>
          <li>
            <strong>Measure completeness.</strong> Coverage is tagged entities
            divided by returned entities. It does not measure the market’s
            population or how complete Qloo’s underlying data is.
          </li>
        </ol>
        <h3>What’s unavailable</h3>
        <p>
          This workspace does not infer demographics, heatmaps, financial
          metrics, or market demand. Trends have a validated server route but
          are not charted until a stable, supported response model is available.
          Qloo Analysis Compare was investigated; this app compares compatible
          returned entity/tag sets deterministically instead of interpreting an
          unverified analysis schema.
        </p>
        <h3>Live Qloo data only</h3>
        <p>
          New comparisons retrieve live Qloo evidence. If the API cannot be
          reached, the app displays an availability dialog. No illustrative
          fallback is used. Older demo explorations are excluded from the saved
          list.
        </p>
      </section>
      <section className="panel">
        <h2>Limits of the lens</h2>
        <ul className="method-list">
          {limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <h3>Questions to take into the real world</h3>
        <ol className="method-list">
          {questions.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ol>
        <h3>Documentation</h3>
        <p>
          <a
            href="https://github.com/qloo/docs-public"
            target="_blank"
            rel="noreferrer"
          >
            Qloo public API documentation <ExternalLink size={13} />
          </a>{" "}
          ·{" "}
          <a
            href="https://github.com/qloo/qloo-hackathon-kit"
            target="_blank"
            rel="noreferrer"
          >
            Qloo hackathon kit
          </a>
        </p>
      </section>
      {!result && (
        <Link className="button primary no-print" to="/build/market">
          Explore with the evidence in view <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}

function TagGuide() {
  return <section className="panel research-brief tag-guide">
    <Link to="/results" className="back-link"><ChevronLeft size={16} /> Back to results</Link>
    <h1>Tags, signals, and evidence</h1>
    <h2>What is a tag?</h2>
    <p>A tag is a label Qloo attaches to an entity, such as a place. It can describe an offering, genre, feature, or other attribute. A Coffee tag may describe a place’s offering; an accessibility tag describes a different kind of attribute. Tags are not all customer interests.</p>
    <h2>Readable categories</h2><p>Morning can appear with a “Time of day” badge. Accessibility describes a place feature. Technical IDs are kept in expandable source details.</p><details><summary>How technical identifiers work</summary>
    <p>A URN is a structured identifier. In this example, “urn” identifies the identifier format, “tag” identifies a tag, “accessibility” names its attribute family, and “place” identifies the entity domain. Additional segments, if present, identify a more specific attribute. The prefix alone does not tell you which accessibility feature a place has; inspect the full tag name and ID.</p></details>
    <h2>What do the counts mean?</h2>
    <p>If Lahore shows 7 and Islamabad shows 3, seven returned places in the Lahore sample and three in the Islamabad sample carry that tag. Each tag is counted once per place. The difference is 4 places, not a popularity percentage or demand score. “Not returned” does not mean the attribute is absent from the city.</p>
    <h2>What is a cultural signal?</h2>
    <p>Here it means a tag found in the returned sample. It is a clue to investigate, not proof of an audience preference or business opportunity.</p>
    <h2>What is evidence?</h2>
    <p>The Evidence link opens the returned places carrying a tag, alongside source IDs and query provenance. This lets you inspect what supports the displayed count. It verifies the sample’s metadata, not citywide demand or financial success.</p>
    <h2>How do filters work?</h2>
    <p>Search matches tag names. Categories use the category metadata returned by Qloo. “Appears in” selects shared or one-sided tags. Minimum place count applies to either sample; minimum count difference uses the absolute difference. “Show differences only” means returned on just one side. Filters combine, and Reset filters clears them. Each table and chart page contains up to ten matching tags.</p>
  </section>;
}

function ResultsOutline({ hasAI, hasResearch }) {
  const [active, setActive] = useState("decision");
  const sections = [["decision", "Overview"], ["research-assistant", "Discuss results"], ["cities", "City snapshots"], ["places", "Places to investigate"], ["comparison", "Compare what matters"], ["evidence", "Evidence table"], ...(hasAI ? [["ai-brief", "AI brief"]] : []), ...(hasResearch ? [["research-activity", "Research activity"]] : []), ["site-checks", "Before you commit"]];
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id);
    }, { rootMargin: "-10% 0px -65% 0px", threshold: 0 });
    for (const [id] of sections) { const node = document.getElementById(id); if (node) observer.observe(node); }
    return () => observer.disconnect();
  }, [hasAI, hasResearch]);
  return <nav className="results-outline" aria-label="Results page outline">
    <Link to="/" className="outline-brand">XenoScope<span>Location research</span></Link>
    <p className="outline-label">ON THIS PAGE</p>
    {sections.map(([id, label], index) => <a key={id} href={`#${id}`} aria-current={active === id ? "location" : undefined} onClick={() => setActive(id)}><span className="outline-index">{String(index + 1).padStart(2, "0")}</span>{label}</a>)}
    <div className="outline-note"><Info size={16} /><span>Evidence first.<br />Verify before investing.</span></div>
  </nav>;
}
function InvestorChecklist() {
  const items = ["Visit shortlisted places and verify your required facilities.", "Interview prospective customers during your planned opening hours.", "Collect comparable rent and fit-out quotations.", "Check permitted use, utilities, access, parking, and lease terms.", "Test prices and the concept with a small pilot."];
  const [checked, setChecked] = useState([]);
  return <section id="site-checks" className="panel investor-checklist">
    <div className="section-head"><h2>Before you commit</h2><span className="count-label">{checked.length} / {items.length} checked</span></div>
    <p>Use this checklist on site. Checks are temporary and are not independently verified.</p>
    {items.map((item, index) => <label key={item}><input type="checkbox" checked={checked.includes(index)} onChange={event => setChecked(previous => event.target.checked ? [...previous, index] : previous.filter(value => value !== index))} /><span>{item}</span></label>)}
  </section>;
}

function PlaceBrowser({ candidate }) {
  const [query, setQuery] = useState("");
  const [feature, setFeature] = useState("");
  const [hasLocation, setHasLocation] = useState(false);
  const [hasWebsite, setHasWebsite] = useState(false);
  const [page, setPage] = useState(1);
  const rows = candidate.entities.filter(entity => `${entity.name} ${entity.address || ""} ${entity.geography || ""}`.toLowerCase().includes(query.toLowerCase()) && (!feature || entity.tags.some(tag => tag.id === feature)) && (!hasLocation || entity.location || entity.address) && (!hasWebsite || entity.website));
  const pages = Math.max(1, Math.ceil(rows.length / 10)); const current = Math.min(page, pages);
  return <div className="place-browser"><h3>{candidate.label}</h3>
    <label>Search places or location<input value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="Name, address, or city" /></label>
    <label>Feature<select value={feature} onChange={e => { setFeature(e.target.value); setPage(1); }}><option value="">All features</option>{[...new Map(candidate.entities.flatMap(entity => entity.tags).map(tag => [tag.id, tag])).values()].sort((a,b)=>a.name.localeCompare(b.name)).map(tag => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select></label>
    <div className="place-filter-checks"><label><input type="checkbox" checked={hasLocation} onChange={e=>{setHasLocation(e.target.checked);setPage(1);}} />With location</label><label><input type="checkbox" checked={hasWebsite} onChange={e=>{setHasWebsite(e.target.checked);setPage(1);}} />With website</label></div>
    <p>{rows.length} matching places on this Qloo page</p>
    {rows.slice((current-1)*10,current*10).map(entity => <Link className="entity-row" key={entity.id} to={`/findings/${encodeURIComponent(entity.id)}`}><span className="entity-icon"><Building2 size={18}/></span><div><strong>{entity.name}</strong><small>{entity.address || entity.geography || "Location details unavailable"}</small><small>{entity.tags.slice(0,2).map(tag=>tag.name).join(" · ")}</small></div><ArrowUpRight size={16}/></Link>)}
    {!rows.length && <p>No matching places on this page. Adjust filters or load another Qloo page.</p>}
    {rows.length > 10 && <nav className="pagination" aria-label={`${candidate.label} place pagination`}><Button disabled={current===1} onClick={()=>setPage(current-1)}>Previous places</Button><span>{current} / {pages}</span><Button disabled={current===pages} onClick={()=>setPage(current+1)}>Next places</Button></nav>}
  </div>;
}
function FindingExtras({ result, entity: originalEntity }) {
  const [entity, setEntity] = useState(originalEntity);
  const [detailError, setDetailError] = useState("");
  const [advice, setAdvice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(""); setAdvice(null); setEntity(originalEntity); setDetailError("");
    (async () => {
      let enriched = originalEntity;
      try {
        const response = await fetch(`/api/entities/details?id=${encodeURIComponent(originalEntity.id)}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || "Place details unavailable.");
        enriched = { ...originalEntity, ...data.entity, affinity: originalEntity.affinity, popularity: originalEntity.popularity, explanation: originalEntity.explanation || data.entity.explanation };
        if (!controller.signal.aborted) setEntity(enriched);
      } catch (e) { if (!controller.signal.aborted) setDetailError(`Qloo detail refresh unavailable. Original place evidence is preserved. ${e.message}`); }
      if (controller.signal.aborted) return;
      const selected = { ...result, candidates: result.candidates.map(candidate => ({ ...candidate, entities: candidate.entities.filter(item=>item.id===originalEntity.id).map(()=>enriched) })) };
      try { const data = await requestAI("/findings/brief", { result: compactAIResult(selected) }, controller.signal); if (!controller.signal.aborted) setAdvice(data.advice); }
      catch (e) { if (!controller.signal.aborted) setError(e.message); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return ()=>controller.abort();
  }, [originalEntity.id, result.id, retry]);
  const coordinate = entity.location ? `${entity.location.latitude},${entity.location.longitude}` : null;
  const mapQuery = coordinate || [entity.name,entity.address,entity.geography].filter(Boolean).join(", ");
  const mapUrl = coordinate || entity.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}` : null;
  return <section className="panel finding-overview">
    <div className="finding-location"><div><span className="eyebrow">LOCATION & LINKS</span><h2>{entity.name}</h2><p>{entity.address || entity.geography || "Address not supplied by Qloo"}</p>{coordinate && <p>Coordinates: {coordinate}</p>}</div><MapPin size={34}/></div>
    <div className="finding-links">{mapUrl && <a className="button primary" href={mapUrl} target="_blank" rel="noreferrer">Open Google Maps <ExternalLink size={16}/></a>}{entity.links?.map(link=><a className="button" key={link.url} href={link.url} target="_blank" rel="noreferrer">{readableLabel(link.label)} <ExternalLink size={14}/></a>)}{entity.website && !entity.links?.some(link=>link.url===entity.website) && <a className="button" href={entity.website} target="_blank" rel="noreferrer">Website <ExternalLink size={14}/></a>}</div>
    <p className="field-hint">Map links use Qloo coordinates or the supplied address. They are not independently verified Google business listings. Social links appear only when supplied; missing links are not guessed.</p>
    <details><summary>All available place information from Qloo</summary><pre>{JSON.stringify(entity.details || {},null,2)}</pre></details>
    {detailError && <p role="status" className="field-hint">{detailError}</p>}
    <div className="finding-facts">{Object.entries(entity.details || {}).filter(([key,value]) => ["phone", "telephone", "business_rating", "price_level", "hours", "hotel_class"].includes(key) && value !== null).map(([key,value])=><div key={key}><strong>{readableLabel(key)}</strong><span>{typeof value === "object" ? JSON.stringify(value) : String(value)}</span></div>)}</div>
    <h3>AI-assisted visit brief</h3>
    {loading && <p role="status"><LoaderCircle size={16} className="spin"/> We are fetching more details…</p>}
    {error && <p role="alert">{error}</p>}
    {advice?.status==="ready" && <><p>{advice.headline}</p><ul>{advice.findings?.map((finding,i)=><li key={i}>{finding.text}</li>)}</ul><h3>Check during your visit</h3><ul>{advice.nextSteps?.map(step=><li key={step}>{step}</li>)}</ul><p>AI interpretation of supplied information, not independently researched business facts.</p></>}
    {advice && advice.status!=="ready" && <p>{advice.reason || "AI is not configured. Available Qloo information is shown above."}</p>}
    {!loading && (error || advice?.status === "unavailable") && <Button onClick={() => setRetry(value => value + 1)}>Retry visit brief</Button>}
  </section>;
}
