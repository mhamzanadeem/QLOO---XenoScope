import { it, expect } from "vitest";
import { decisionBrief } from "../shared/decision.js";
import { liveFixture } from "./live-fixture.js";
it("links exact feature matches and keeps missing requirements unverified", () => {
  const result = liveFixture();
  result.request.brief = { audience: "Students", features: ["Wi-Fi", "Quiet reading space"], decision: "neighborhood", constraints: "Rent limit" };
  result.candidates[0].entities[0].tags = [{ id: "test:wifi", name: "Wi Fi", category: "Facilities" }];
  const brief = decisionBrief(result);
  expect(brief.requirements[0].matches[0][0].id).toBe(result.candidates[0].entities[0].id);
  expect(brief.requirements[1].matches.every(matches => matches.length === 0)).toBe(true);
  expect(brief.recommendation).toContain("winner is not established");
  expect(brief.unknowns).toContain("Neighborhood suitability: this city-level search does not compare neighborhoods");
});
it("does not recommend a winner from empty or incomplete samples", () => {
  const result = liveFixture();
  result.candidates[0].entities = [];
  expect(decisionBrief(result).recommendation).toContain("missing location");
  result.candidates[1].entities = [];
  expect(decisionBrief(result).recommendation).toContain("Refine the search");
});

it("prioritizes explicit feature matches without converting them to city demand scores", () => {
  const result = liveFixture();
  result.request.brief = { audience: "Readers", features: ["Wi-Fi"], decision: "city", constraints: "" };
  result.candidates[0].entities[2].tags = [{ id: "test:wifi", name: "Wi Fi", category: "Features" }];
  const report = decisionBrief(result);
  expect(report.cityEvidence[0].shortlist[0].id).toBe(result.candidates[0].entities[2].id);
  expect(report.cityEvidence[0].documentedRequirements).toBe(1);
  expect(report.unknowns).toContain("Customer demand and willingness to pay");
});
