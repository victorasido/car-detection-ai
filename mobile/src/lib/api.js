const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

function buildFilePart(asset) {
  const name = asset.name || asset.file?.name || "upload.bin";
  const type = asset.mimeType || asset.file?.type || guessMimeType(name);
  const uri = asset.uri;

  return {
    uri,
    name,
    type,
  };
}

function guessMimeType(name) {
  const lower = String(name).toLowerCase();
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

async function request(path, formData) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    body: formData,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.detail || payload?.message || `HTTP ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

export async function compareVehicles(fileA, fileB) {
  const form = new FormData();
  form.append("video_a", buildFilePart(fileA));
  form.append("video_b", buildFilePart(fileB));
  return request("/compare", form);
}

export async function analyzeVehicle(file) {
  const form = new FormData();
  form.append("file", buildFilePart(file));
  return request("/analyze", form);
}

export async function valuateVehicle(file, referencePrice, manufactureYear, mileageKm, currency) {
  const form = new FormData();
  form.append("file", buildFilePart(file));
  form.append("reference_price", String(referencePrice));

  if (manufactureYear) form.append("manufacture_year", String(manufactureYear));
  if (mileageKm) form.append("mileage_km", String(mileageKm));
  if (currency) form.append("currency", String(currency).toUpperCase());

  return request("/valuation", form);
}

export { API_BASE };
