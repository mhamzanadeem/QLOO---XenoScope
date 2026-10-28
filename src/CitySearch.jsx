import { useEffect, useId, useState } from "react";
export default function CitySearch({ label, value, onChange }) {
  const id = useId();
  const [cities, setCities] = useState([]);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  useEffect(() => {
    if (!value.trim() || !open) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true); setError("");
      try {
        const response = await fetch(`/api/cities/search?q=${encodeURIComponent(value)}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || "City suggestions unavailable. Enter your city manually.");
        if (!controller.signal.aborted) { setCities(data.cities || []); setActive(-1); }
      } catch (e) { if (!controller.signal.aborted) { setError(e.message); setCities([]); } }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [value, open]);
  const choose = city => { onChange([city.name, city.state, city.country].filter(Boolean).join(", ")); setOpen(false); setCities([]); setLoading(false); };
  return <div className="city-search">
    <label htmlFor={id}>{label}</label>
    <input id={id} role="combobox" aria-autocomplete="list" aria-expanded={open && cities.length > 0} aria-controls={`${id}-list`} aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined} placeholder="Enter your city" className={!value ? "city-required" : ""} value={value} required minLength={2} maxLength={100} autoComplete="off" onChange={e => { onChange(e.target.value); setCities([]); setOpen(true); setActive(-1); }} onFocus={() => setOpen(true)} onBlur={() => { setOpen(false); setLoading(false); }} onKeyDown={e => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowDown" && cities.length) { e.preventDefault(); setActive(i => Math.min(i + 1, cities.length - 1)); }
      if (e.key === "ArrowUp" && cities.length) { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
      if (e.key === "Enter" && open && active >= 0 && cities[active]) { e.preventDefault(); choose(cities[active]); }
    }} />
    {loading && open && <small role="status">Searching cities…</small>}
    {open && error && <small role="status">{error}</small>}
    {open && cities.length > 0 && <ul id={`${id}-list`} role="listbox" className="city-options">{cities.map((city, i) => <li id={`${id}-${i}`} role="option" aria-selected={i === active} key={`${city.name}:${city.state}:${city.country}`} onMouseDown={e => e.preventDefault()} onClick={() => choose(city)}><strong>{city.name}</strong><small>{[city.state, city.country].filter(Boolean).join(", ")}</small></li>)}</ul>}
  </div>;
}
