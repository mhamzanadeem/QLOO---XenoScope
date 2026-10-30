import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { it, expect, afterEach } from "vitest";
import AppLink, { ResultNavigationContext } from "../src/AppLink.jsx";
import { readNavigationResult } from "../src/store.js";
import { liveFixture } from "./live-fixture.js";
afterEach(() => { cleanup(); localStorage.clear(); });

it("opens findings in a separate tab with a restorable comparison", () => {
  const result = liveFixture();
  render(<MemoryRouter><ResultNavigationContext.Provider value={result}><AppLink to="/findings/example">Inspect evidence</AppLink></ResultNavigationContext.Provider></MemoryRouter>);
  const link = screen.getByRole("link", { name: "Inspect evidence" });
  expect(link).toHaveAttribute("target", "_blank");
  expect(link).toHaveAttribute("rel", "noopener noreferrer");
  expect(link.getAttribute("href")).toContain(`exploration=${result.id}`);
  fireEvent.click(link);
  expect(readNavigationResult(result.id).candidates).toEqual(result.candidates);
  expect(readNavigationResult("different-report")).toBeNull();
});
