import { createRequire } from "node:module";
import { ApiError } from "./qloo.js";
const require = createRequire(import.meta.url);
let records;
const normalize = value => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
export function searchCities(rows, query) {
  const terms = normalize(query).split(/[,\s]+/).filter(Boolean);
  if (!terms.length) return [];
  return rows.filter(row => terms.every(term => normalize(`${row.name} ${row.state} ${row.country}`).includes(term)))
    .sort((a, b) => Number(normalize(b.name).startsWith(terms[0])) - Number(normalize(a.name).startsWith(terms[0])) || a.name.localeCompare(b.name) || a.country.localeCompare(b.country))
    .slice(0, 20);
}
export function citySuggestions(query) {
  if (!records) {
    let library;
    try { library = require("country-state-city"); }
    catch { throw new ApiError(503, "CITY_DATA_MISSING", "Worldwide city suggestions require setup: run npm install country-state-city, then restart the server. You can still enter a city manually."); }
    const countries = new Map(library.Country.getAllCountries().map(country => [country.isoCode, country.name]));
    const states = new Map(library.State.getAllStates().map(state => [`${state.countryCode}:${state.isoCode}`, state.name]));
    records = library.City.getAllCities().map(city => ({ name: city.name, state: states.get(`${city.countryCode}:${city.stateCode}`) || "", country: countries.get(city.countryCode) || city.countryCode }));
  }
  return searchCities(records, query);
}
