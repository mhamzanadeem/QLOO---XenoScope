import { createContext, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { cacheNavigationResult } from "./store.js";

export const ResultNavigationContext = createContext(null);

export default function AppLink({ to, onClick, children, ...props }) {
  const result = useContext(ResultNavigationContext);
  const navigate = useNavigate();
  const internal = typeof to === "string" && to.startsWith("/");
  const needsResult = internal && result && (/^\/(findings\/|results(?:\?|$)|report(?:\?|$))/.test(to) || (to.startsWith("/build/") && to.includes("edit=1")));
  let destination = to;
  if (needsResult) {
    const url = new URL(to, window.location.origin);
    url.searchParams.set("exploration", result.id);
    destination = url.pathname + url.search + url.hash;
  }
  return <Link {...props} to={destination} target="_blank" rel="noopener noreferrer" onClick={event => {
    onClick?.(event);
    // Keep the comparison available even if browser storage is unavailable.
    if (!event.defaultPrevented && needsResult && !cacheNavigationResult(result)) {
      event.preventDefault(); navigate(to);
    }
  }}>{children}</Link>;
}
