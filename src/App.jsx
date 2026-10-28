import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  Routes,
  Route,
  Link,
  NavLink,
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
import { api, readSaved, saveResult, deleteSaved, download } from "./store.js";
const SignalChart = lazy(() => import("./SignalChart.jsx"));
const modes = [
  {
    id: "market",
    icon: MapPin,
    name: "Market vs Market",
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
const Title = ({ eyebrow, title, children }) => (
  <header className="page-title">
    <p className="eyebrow">{eyebrow}</p>
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
  const [result, setResult] = useState(null);
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
  const location = useLocation();
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
    <div className={landing ? "app landing-app" : "app workspace-app"}>
      <QlooModal
        message={unavailable}
        retrying={retrying}
        onRetry={checkConnection}
        onClose={() => setUnavailable("")}
      />
      <a href="#main" className="skip">
        Skip to content
      </a>
      {landing ? (
        <nav className="landing-nav">
          <Link to="/" aria-label="XenoScope home">
            <img src="/brand/xenoscope-logo.svg" alt="XenoScope" width="172" />
          </Link>
          <div>
            <Link to="/explore">Compare</Link>
            <Link to="/methodology">Methodology</Link>
            <Link to="/saved">Saved explorations</Link>
          </div>
          <Link to="/explore" className="button small">
            Open workspace <ArrowUpRight size={15} />
          </Link>
        </nav>
      ) : (
        <aside className="sidebar">
          <Link to="/" className="brand">
            <img src="/brand/xenoscope-logo.svg" alt="XenoScope" />
          </Link>
          <div className="nav-label">YOUR WORKSPACE</div>
          <NavLink to="/explore">
            <Compass size={19} /> Explore markets
          </NavLink>
          <NavLink to="/results">
            <Layers3 size={19} /> Comparison
          </NavLink>
          <NavLink to="/saved">
            <Bookmark size={19} /> Saved explorations
          </NavLink>
          <NavLink to="/methodology">
            <FileText size={19} /> Methodology
          </NavLink>
          <div className="sidebar-bottom">
            <div className="status-light" />
            {config
              ? config.liveConfigured
                ? "Live Qloo configured"
                : "Qloo configuration required"
              : "Checking connection"}

          </div>
        </aside>
      )}
      <div className="main-wrap">
        {!landing && (
          <div className="topbar">
            <span>Workspace</span>
            <Link to="/build/market">
              <Plus size={15} /> New exploration
            </Link>
          </div>
        )}
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
            <Route path="/explore" element={<Explore />} />
            <Route path="/build/:mode" element={<Builder {...context} />} />
            <Route path="/results" element={<Results {...context} />} />
            <Route path="/findings/:id" element={<Finding result={result} />} />
            <Route path="/saved" element={<Saved setResult={setResult} />} />
            <Route path="/report" element={<Report result={result} />} />
            <Route path="/methodology" element={<Report />} />
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
    </div>
  );
}

function Landing() {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="line" /> CULTURAL INTELLIGENCE, IN FOCUS
          </p>
          <h1>
            Compare markets.
            <br /><span>Find cultural connections.</span>
          </h1>
          <p>
            Compare places and interests with evidence from Qloo.
          </p>
          <div className="actions">
            <Link className="button primary" to="/explore">
              Start exploring <ArrowRight size={17} />
            </Link>
            <Link className="button" to="/build/market">
              Compare markets <FlaskConical size={16} />
            </Link>
          </div>

        </div>
        <div className="hero-art">
          <div className="art-caption">
            <span>THE XENOSCOPE LENS</span>
            <span>01 / CULTURAL CONNECTIONS</span>
          </div>
          <img
            src="/brand/xenoscope-hero.svg"
            alt="Conceptual city landscape with a scanning beam revealing connections between buildings"
          />
          <div className="art-card">
            <span className="crosshair">⌖</span>
            <div>
              Different places. Shared interests.
              <small>Find the connections worth investigating.</small>
            </div>
          </div>
        </div>
      </section>
      <footer className="landing-footer">
        <img src="/brand/xenoscope-logo.svg" width="155" alt="XenoScope" />
        <span>
          Cultural signals inform exploration. They do not predict business
          success.
        </span>
        <Link to="/methodology">
          Sources & methodology <ArrowUpRight size={14} />
        </Link>
      </footer>
    </>
  );
}

function Explore() {
  return (
    <>
      <Title
        eyebrow="01 / FRAME YOUR QUESTION"
        title="What would you like to compare?"
      >
        Choose a comparison.
      </Title>
      <div className="mode-grid">
        {modes.map(({ id, icon: Icon, name, description, example }, i) => (
          <Link className="mode-card" key={id} to={`/build/${id}`}>
            <span className="card-index">0{i + 1}</span>
            <div className={`icon-box ${i === 1 ? "violet-bg" : ""}`}>
              <Icon size={28} />
            </div>
            <h2>{name}</h2>
            <p>{description}</p>
            <span className="mode-example">{example}</span>
            <span className="text-link">
              Build comparison <ArrowRight size={17} />
            </span>
          </Link>
        ))}
      </div>

    </>
  );
}

function LiveSearch({ kind, onSelect, selected, label }) {
  const [query, setQuery] = useState("");
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
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              onSelect(null);
            }}
            placeholder={
              kind === "tag"
                ? "Search tags, e.g. coffee"
                : "Search a venue by name"
            }
            autoComplete="off"
          />
        </div>
      </label>
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
                <small>{item.geography || item.category || item.id}</small>
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
    edit?.tagId ? { id: edit.tagId, name: edit.tagId } : null,
  );
  const [loading, setLoading] = useState(false);
  const [research, setResearch] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setCandidates(edit?.candidates || initial.map((label) => ({ label })));
    setTag(edit?.tagId ? { id: edit.tagId, name: edit.tagId } : null);
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
    });
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join(" "));
      return;
    }
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
    <>
      <Link to="/explore" className="back-link">
        <ChevronLeft size={16} /> All exploration modes
      </Link>
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
            Select tags or venues from search results.
          </p>
          {mode !== "venue" && (
            <label className="field">
              {mode === "concept" ? "Exploration question" : "Business concept"}
              <input
                required
                minLength={2}
                maxLength={100}
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
              />
            </label>
          )}
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
          <div className="candidate-inputs">
            {candidates.map((candidate, i) => (
              <div className={`candidate-input candidate-${i}`} key={i}>
                <div className="section-head">
                  <span className="eyebrow">
                    CANDIDATE {i === 0 ? "A" : "B"}
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
                ) : (
                  <label>
                    {mode === "market" ? "Market" : "Concept"}
                    <input
                      required
                      minLength={2}
                      maxLength={100}
                      value={candidate.label}
                      onChange={(e) =>
                        updateCandidate(i, { label: e.target.value })
                      }
                      placeholder={
                        mode === "market" ? "City name" : "Concept label"
                      }
                    />
                  </label>
                )}
                {mode === "concept" && (
                  <LiveSearch
                    kind="tag"
                    label={`Verified tag for concept ${i === 0 ? "A" : "B"}`}
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
          {mode === "market" && (
            <>
              <LiveSearch
                kind="tag"
                label="Verified cultural tag"
                selected={tag}
                onSelect={setTag}
              />
              <p className="field-hint">
                Select a tag compatible with places. Coverage can vary by
                location.
              </p>
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
          <label className="research-toggle"><input type="checkbox" checked={research} onChange={e => setResearch(e.target.checked)} /> Investigate coverage and suggest a next step</label>
          <div className="form-bottom">
            <span>
              Compare cultural signals.
            </span>
            <Button className="primary" disabled={loading} type="submit">
              {loading ? (
                <>
                  <LoaderCircle className="spin" size={17} /> Retrieving
                  signals…
                </>
              ) : (
                <>
                  Run comparison <ArrowRight size={17} />
                </>
              )}
            </Button>
          </div>
        </form>
        <aside className="builder-aside">
          <div className="icon-box">
            <Compass size={26} />
          </div>
          <h3>
            Start with curiosity.
            <br />
            Leave with better questions.
          </h3>
          <p>
            We align cultural tags across Qloo’s returned entities, highlight
            differences, and show what’s missing.
          </p>
          <ol>
            <li>Compare the same kind of evidence</li>
            <li>Keep the source in view</li>
            <li>Validate in the real world</li>
          </ol>
          <div className="small-print">
            All new explorations use live Qloo data. Cultural signals are
            hypotheses to validate, not predictions.
          </div>
        </aside>
      </div>
    </>
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
      <Link to="/explore" className="button primary">
        Start exploring <ArrowRight size={16} />
      </Link>
    </div>
  );
}

function Results({ result }) {
  const [differences, setDifferences] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("difference");
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
  }, [result?.id]);
  if (!result) return <Empty />;
  const rows = filterRows(analysis.rows, {
    differences,
    query,
    category,
    sort,
  });
  return (
    <>
      {result?.research && <section className="panel research-brief">
        <h2>Research brief</h2>
        <p>{result.research.nextStep}</p>
        {result.research.evidence.map(e => <p key={e.id}><Link to={`/findings/${encodeURIComponent(e.id)}`}>{e.name}</Link> ({e.counts.join(" / ")} returned places)</p>)}
        <details><summary>Research activity</summary><ol>{result.research.trace.map(t => <li key={t.action}><strong>{t.action}</strong>: {t.detail}</li>)}</ol>
        {result.research.alternatives.length > 0 && <p>Alternative tags: {result.research.alternatives.map(t => t.name).join(", ")}</p>}
        <p>{result.research.caveat}</p></details>
      </section>}

      <div className="breadcrumb">
        EXPLORATIONS <span>/</span> {result.request.mode.toUpperCase()}{" "}
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
      <div className="comparison-candidates">
        {result.candidates.map((candidate, i) => (
          <section className={`candidate-panel candidate-${i}`} key={i}>
            <div className="section-head">
              <p className="eyebrow">CANDIDATE {i === 0 ? "A" : "B"}</p>
              <MapPin size={18} />
            </div>
            <h2>{candidate.label}</h2>
            <p>
              {result.request.mode === "concept"
                ? result.request.location
                : result.request.mode === "venue"
                  ? "Venue cultural exploration"
                  : "Market cultural exploration"}
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
                <span>entities with tags</span>
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
                <span>unique tags</span>
              </div>
            </div>
          </section>
        ))}
        <span className="center-vs">VS</span>
      </div>
      <section className="insight-strip">
        <Sparkles size={22} />
        <div>
          <span className="eyebrow">WHAT THE RETURNED DATA SHOWS</span>
          <p>{analysis.summary}</p>
        </div>
      </section>
      <div className="results-grid">
        <section className="panel signal-panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">CULTURAL CONNECTIONS</p>
              <h2>Where the patterns diverge</h2>
            </div>
            <span className="count-label">{rows.length} tags</span>
          </div>
          <p className="muted">
            Number of returned entities carrying each tag. No affinity or demand
            score.
          </p>
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
              rows={rows}
              labels={result.candidates.map((c) => c.label)}
            />
          </Suspense>
          <div className="filters">
            <div className="input-icon">
              <Search size={15} />
              <input
                aria-label="Filter signals"
                placeholder="Find a cultural signal…"
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
                <option key={c}>{c}</option>
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
              }}
            >
              Reset filters
            </button>
          </div>
          <div className="table-scroll">
            <table>
              <caption className="sr-only">
                Cultural tag counts in returned entities, accessible alternative
                to the chart
              </caption>
              <thead>
                <tr>
                  <th>Signal / tag</th>
                  <th>{result.candidates[0].label}</th>
                  <th>{result.candidates[1].label}</th>
                  <th>Evidence</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link to={`/findings/${encodeURIComponent(row.id)}`}>
                        {row.name}
                      </Link>
                      <small>{row.category}</small>
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
          {!rows.length && (
            <p className="empty">
              No tags match these filters. Reset filters to see all available
              signals.
            </p>
          )}
          <p className="source-note">
            Source: Qloo /v2/insights.{" "}
            Computed by counting unique tags per returned entity.
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
                  {c.tagged} of {c.total} entities have tags
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
      <section className="panel entity-section">
        <div className="section-head">
          <div>
            <p className="eyebrow">BEHIND THE SIGNALS</p>
            <h2>Explore the returned places</h2>
          </div>
          <span className="muted">Inspect an entity to see its source</span>
        </div>
        <div className="entity-columns">
          {result.candidates.map((c, i) => (
            <div key={i}>
              <h3 className={i ? "violet" : "cyan"}>{c.label}</h3>
              {!c.entities.length && (
                <p>No entities returned. Try another query.</p>
              )}
              {c.entities.map((e) => (
                <Link
                  className="entity-row"
                  key={e.id}
                  to={`/findings/${encodeURIComponent(e.id)}`}
                >
                  <span className="entity-icon">
                    <Building2 size={18} />
                  </span>
                  <div>
                    <strong>{e.name}</strong>
                    <small>
                      {e.tags
                        .slice(0, 2)
                        .map((t) => t.name)
                        .join(" · ") || "Tag metadata unavailable"}
                    </small>
                  </div>
                  <ArrowUpRight size={16} />
                </Link>
              ))}
            </div>
          ))}
        </div>
      </section>
      <Notice>
        {limitations[0]} Demographic, heatmap, and trend data are not returned
        by this comparison. <Link to="/report">Inspect methodology</Link>.
      </Notice>
    </>
  );
}

function Finding({ result }) {
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
      <div className="detail-layout">
        <section className="panel">
          <Source source={result.source} />
          <h2>
            {tag
              ? "A cultural tag in the returned results"
              : "A returned place"}
          </h2>
          <p>
            {tag
              ? "This tag appeared on the entities listed below. Counts refer only to the bounded result sets."
              : entity.description ||
                "No description was returned by the source."}
          </p>
          <div className="source-id">Source ID: {id}</div>
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
                    {tag ? "entities with this tag" : "matching entities"}
                  </span>
                </h3>
                {evidence.length ? (
                  evidence.map((e) => (
                    <div className="evidence-item" key={e.id}>
                      <strong>{e.name}</strong>
                      <p>
                        {e.tags.map((t) => t.name).join(" · ") ||
                          "Tags unavailable"}
                      </p>
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
              ? "This tag appeared in both result sets. Its presence is a shared cultural connection."
              : tag
                ? "This tag appeared in one result set but not the other. Investigate the difference as a hypothesis."
                : "This entity is evidence returned for the query. Its inclusion is not a business recommendation."}
          </p>
          <Notice>{limitations[0]}</Notice>
          <h3>Related returned tags</h3>
          <div className="tag-list">
            {(entity?.tags || []).map((t) => (
              <Link to={`/findings/${encodeURIComponent(t.id)}`} key={t.id}>
                {t.name}
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
              request at most 20 places per candidate. Counts refer only to
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
        <Link className="button primary no-print" to="/explore">
          Explore with the evidence in view <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}
