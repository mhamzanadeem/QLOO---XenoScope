import { describe, it, expect } from "vitest";
import {
  normalizeEntity,
  uniqueById,
  compareCandidates,
  compareNumber,
  filterRows,
  toCSV,
  buildReport,
} from "../shared/compare.js";
import { liveFixture } from "./live-fixture.js";
import { requestSchema, resultSchema } from "../shared/schema.js";
const request = {
  mode: "market",
  source: "live",
  tagId: "urn:tag:offerings:place:coffee",
  concept: "Specialty coffee",
  candidates: [{ label: "Lahore" }, { label: "Islamabad" }],
};
describe("comparison engine", () => {
  it("normalizes and deduplicates IDs without filling missing metrics", () => {
    const entity = normalizeEntity({
      entity_id: " ABC ",
      name: "Example",
      tags: [
        { id: "TAG", name: "Tag" },
        { id: "tag", name: "Tag" },
      ],
    });
    expect(entity.id).toBe("abc");
    expect(entity.tags).toHaveLength(1);
    expect(entity.affinity).toBeNull();
    expect(entity.popularity).toBeNull();
    expect(uniqueById([entity, entity])).toHaveLength(1);
  });
  it("only subtracts finite compatible measures", () => {
    expect(compareNumber(2, 1, "count", "count").delta).toBe(1);
    expect(compareNumber(null, 1, "count", "count").status).toBe("missing");
    expect(compareNumber(1, 1, "rating", "affinity").status).toBe(
      "incompatible",
    );
  });
  it("finds shared and one-sided tags and computes metadata coverage", () => {
    const result = liveFixture(request);
    const analysis = compareCandidates(result.candidates);
    expect(analysis.shared).toBe(4);
    expect(analysis.rows.some((r) => r.a === 0 && r.b > 0)).toBe(true);
    expect(analysis.coverage[0].tagged).toBe(4);
    expect(analysis.coverage[0].affinity).toBe(0);
  });
  it("sorts and filters deterministically", () => {
    const rows = compareCandidates(liveFixture(request).candidates).rows;
    expect(
      filterRows(rows, { differences: true }).every((r) => !r.shared),
    ).toBe(true);
    expect(filterRows(rows, { query: "coffee" })).toHaveLength(1);
    expect(
      filterRows(rows, { category: "Lifestyle" }).every(
        (r) => r.category === "Lifestyle",
      ),
    ).toBe(true);
    const sorted = filterRows(rows, { sort: "name" });
    expect(sorted[0].name).toBe("Book culture");
  });
  it("validates mode-specific inputs and rejects identical candidates", () => {
    expect(requestSchema.safeParse(request).success).toBe(true);
    expect(
      requestSchema.safeParse({
        ...request,
        candidates: [{ label: "Lahore" }, { label: "Lahore" }],
      }).success,
    ).toBe(false);
    expect(
      requestSchema.safeParse({ ...request, tagId: undefined }).success,
    ).toBe(false);
    expect(
      requestSchema.safeParse({ ...request, mode: "concept" }).success,
    ).toBe(false);
  });
  it("exports provenance, limitations, and safe CSV cells", () => {
    const result = liveFixture(request);
    result.candidates[0].label = '=HYPERLINK("bad")';
    expect(toCSV(result)).toContain("'=HYPERLINK");
    expect(toCSV(result)).toContain("Limitation");
    expect(buildReport(result).attribution).toContain("Qloo API");
    expect(
      JSON.parse(JSON.stringify(buildReport(result))).candidates,
    ).toHaveLength(2);
  });
  it("rejects mixed provenance in report structures", () => {
    const result = liveFixture(request);
    result.candidates[0].provenance.illustrative = true;
    expect(resultSchema.safeParse(result).success).toBe(false);
  });
});

it("retains detailed source properties and rejects unsafe external links", () => {
  const entity = normalizeEntity({ entity_id: "detail-test", name: "Place", properties: { address: { street: "Road 1", city: "Islamabad" }, website: "javascript:alert(1)", phone: "123", social: { instagram: { url: "https://instagram.com/example" } } }, location: { lat: 33.7, lon: 73.1 } });
  expect(entity.website).toBeNull();
  expect(entity.address).toBe("Road 1, Islamabad");
  expect(entity.location.longitude).toBe(73.1);
  expect(entity.details.phone).toBe("123");
  expect(entity.links.some(link => link.url.startsWith("javascript:"))).toBe(false);
  expect(entity.links[0].url).toBe("https://instagram.com/example");
});
