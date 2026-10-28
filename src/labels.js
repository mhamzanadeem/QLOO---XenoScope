// Presentation only: original identifiers stay intact for matching and exports.
export function readableLabel(value = "") {
  const text = String(value);
  const parts = text.split(":");
  const label = text.startsWith("urn:tag:") ? parts[2] : text.startsWith("urn:") ? parts.at(-1) : text;
  return (label || "Other").replaceAll("_", " ").replaceAll("-", " ").replace(/\b\w/g, c => c.toUpperCase());
}
export function featureCategory(feature) {
  if (feature.category?.startsWith("urn:")) return readableLabel(feature.category);
  if (feature.id?.startsWith("urn:tag:")) return readableLabel(feature.id);
  return feature.category || "Place feature";
}
