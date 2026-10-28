import { it, expect } from "vitest";
import { searchCities } from "../server/cities.js";
it("searches city country and state names with accent folding and a bounded result list", () => {
  const rows = [{ name: "Islamabad", state: "Capital", country: "Pakistan" }, { name: "Paris", state: "Texas", country: "United States" }, { name: "Paris", state: "Ile-de-France", country: "France" }, { name: "São Paulo", state: "Sao Paulo", country: "Brazil" }];
  expect(searchCities(rows, "Paris France")).toHaveLength(1);
  expect(searchCities(rows, "Pakistan")[0].name).toBe("Islamabad");
  expect(searchCities(rows, "sao")[0].country).toBe("Brazil");
  expect(searchCities(Array.from({ length: 50 }, (_, i) => ({ name: `City ${i}`, state: "", country: "Country" })), "City")).toHaveLength(20);
});
