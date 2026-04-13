import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";
const TOKEN_KEY = "auth_token";

async function saveToken(token) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

async function getToken() {
  return await AsyncStorage.getItem(TOKEN_KEY);
}

export async function clearToken() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

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

async function request(path, options = {}) {
  const token = await getToken();
  const headers = options.headers || {};
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
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

export async function login(username, password) {
  const payload = await request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (payload.access_token) {
    await saveToken(payload.access_token);
  }
  return payload;
}

export async function register(username, password) {
  return request("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
}

export async function getMe() {
  return request("/auth/me");
}

export async function compareVehicles(fileA, fileB) {
  const form = new FormData();
  form.append("video_a", buildFilePart(fileA));
  form.append("video_b", buildFilePart(fileB));
  return request("/compare", { method: "POST", body: form });
}

export async function analyzeVehicle(file) {
  const form = new FormData();
  form.append("file", buildFilePart(file));
  return request("/analyze", { method: "POST", body: form });
}

export async function valuateVehicle(file, referencePrice, manufactureYear, mileageKm, currency) {
  const form = new FormData();
  form.append("file", buildFilePart(file));
  form.append("reference_price", String(referencePrice));

  if (manufactureYear) form.append("manufacture_year", String(manufactureYear));
  if (mileage_km) form.append("mileage_km", String(mileage_km));
  if (currency) form.append("currency", String(currency).toUpperCase());

  return request("/valuation", { method: "POST", body: form });
}

export { API_BASE };
