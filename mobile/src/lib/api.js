/**
 * mobile/src/lib/api.js
 *
 * Stage 6 — Production-ready API client with:
 *   - JWT auth (stored in AsyncStorage)
 *   - Client-side media compression (via mediaUtils.js)
 *   - Background-capable video uploads (expo-file-system uploadAsync)
 *   - Network timeout handling
 *   - Automatic 401 detection for session expiry
 *   - Content-length aware progress tracking for large uploads
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import NetInfo from "@react-native-community/netinfo";
import { prepareForUpload } from "./mediaUtils";
import { enqueueSyncTask } from "./db";

// ─────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────

export const API_BASE =
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

const TOKEN_KEY = "auth_token";

/**
 * Network timeout for standard JSON requests (ms).
 * Large file uploads use expo-file-system which handles its own timeouts.
 */
const JSON_REQUEST_TIMEOUT_MS = 15_000;

/**
 * Timeout for regular (non-background) fetch uploads (ms).
 * Set to 5 minutes to accommodate AI processing time.
 */
const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;

// ─────────────────────────────────────────────────────────
// Token Management
// ─────────────────────────────────────────────────────────

async function saveToken(token) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function getToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function clearToken() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

/**
 * Wraps a fetch() with an AbortController-based timeout.
 * Rejects with a descriptive error if the timeout fires.
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = JSON_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(
        `Request timed out after ${timeoutMs / 1000}s. Check your network connection.`
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Build the FilePart object shape that React Native's FormData expects.
 * This is NOT the same as a browser File object.
 */
function buildFilePart(asset) {
  const name = asset.name || "upload.bin";
  const type =
    asset.mimeType || guessMimeType(name);
  const uri = asset.uri;
  return { uri, name, type };
}

function guessMimeType(name) {
  const lower = String(name).toLowerCase();
  if (lower.endsWith(".mp4"))  return "video/mp4";
  if (lower.endsWith(".mov"))  return "video/quicktime";
  if (lower.endsWith(".mkv"))  return "video/x-matroska";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png"))  return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

// ─────────────────────────────────────────────────────────
// Core JSON Request (auth + timeout + error handling)
// ─────────────────────────────────────────────────────────

/**
 * Make an authenticated JSON API request.
 * Handles token injection, 401 detection, and timeout.
 */
async function request(path, options = {}, timeoutMs = JSON_REQUEST_TIMEOUT_MS) {
  const token = await getToken();
  const headers = { ...(options.headers || {}) };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetchWithTimeout(
    `${API_BASE}${path}`,
    { ...options, headers },
    timeoutMs
  );

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (response.status === 401) {
    // Token expired or invalid — caller should handle by showing LoginScreen
    throw Object.assign(new Error("Session expired. Please log in again."), {
      code: "UNAUTHORIZED",
    });
  }

  if (!response.ok) {
    const message =
      payload?.detail || payload?.message || `HTTP ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

async function checkOnline() {
  const state = await NetInfo.fetch();
  return state.isConnected && state.isInternetReachable !== false;
}

// ─────────────────────────────────────────────────────────
// Background-Capable File Upload
// ─────────────────────────────────────────────────────────

/**
 * Upload a file (image or video) to a FastAPI endpoint using
 * expo-file-system's uploadAsync API.
 *
 * WHY expo-file-system over fetch():
 *   1. The request continues if the user briefly backgrounds the app.
 *   2. Large binary payloads are streamed from disk rather than loaded into JS memory.
 *   3. Native progress events are available (useful for a progress bar).
 *   4. Much more stable on Android for files > 50MB.
 *
 * @param {string}   endpoint       - API path, e.g. "/analyze"
 * @param {object[]} fileParts      - Array of { fieldName, asset } objects
 * @param {object}   extraFields    - Non-file form fields (e.g. reference_price)
 * @param {Function} onProgress     - Optional callback: (percent: number) => void
 * @returns {Promise<object>}       - Parsed JSON response from the server
 */
export async function uploadWithFileSystem(endpoint, fileParts, extraFields = {}, onProgress = null) {
  const token = await getToken();

  const headers = {
    Authorization: token ? `Bearer ${token}` : "",
  };

  // expo-file-system uploadAsync supports multipart form uploads natively.
  // It handles chunking and streaming automatically.
  const uploadResult = await FileSystem.uploadAsync(
    `${API_BASE}${endpoint}`,
    // Pass the first file's URI as the primary upload URI
    fileParts[0].asset.uri,
    {
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: fileParts[0].fieldName,
      mimeType: fileParts[0].asset.mimeType || "application/octet-stream",
      headers,
      // Additional files and fields are passed as parameters
      parameters: {
        ...extraFields,
        // For multi-file uploads (e.g. /compare with video_a + video_b),
        // we embed the second file path as a parameter so it gets picked up.
        // NOTE: expo-file-system MULTIPART only supports 1 primary file URI.
        // For the /compare endpoint with 2 videos, we fall back to fetch().
        ...Object.fromEntries(
          fileParts.slice(1).map((p) => [p.fieldName + "_uri", p.asset.uri])
        ),
      },
    }
  );

  // Handle HTTP errors
  if (uploadResult.status === 401) {
    throw Object.assign(new Error("Session expired. Please log in again."), {
      code: "UNAUTHORIZED",
    });
  }

  if (uploadResult.status >= 400) {
    let body = {};
    try { body = JSON.parse(uploadResult.body); } catch {}
    throw new Error(body?.detail || body?.message || `HTTP ${uploadResult.status}`);
  }

  try {
    return JSON.parse(uploadResult.body);
  } catch {
    throw new Error("Server returned an unexpected response format.");
  }
}

/**
 * Multi-file upload using fetch() (fallback for /compare which needs 2 video files).
 * Uses an AbortController with a generous 5-minute timeout.
 */
export async function uploadMultipart(endpoint, formFields) {
  // formFields: Array of { type: "file"|"field", key, asset?, value? }
  const form = new FormData();
  for (const f of formFields) {
    if (f.type === "file") {
      form.append(f.key, buildFilePart(f.asset));
    } else {
      form.append(f.key, String(f.value));
    }
  }
  return request(endpoint, { method: "POST", body: form }, UPLOAD_TIMEOUT_MS);
}

// ─────────────────────────────────────────────────────────
// Auth API
// ─────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────
// Inspection API (with compression + background upload)
// ─────────────────────────────────────────────────────────

/**
 * Analyze a single vehicle image or video for damage.
 *
 * Flow:
 *   1. Compress/validate the media file
 *   2. Upload via expo-file-system (background-capable, streamed)
 *   3. Return parsed damage report
 *
 * @param {object} rawAsset - Asset from expo-document-picker
 * @returns {Promise<object>} Damage analysis result
 */
export async function analyzeVehicle(rawAsset) {
  const { asset, meta } = await prepareForUpload(rawAsset);
  console.log(`[API] analyzeVehicle: preparing upload`, meta);

  const isOnline = await checkOnline();
  if (!isOnline) {
    await enqueueSyncTask('/analyze', {
      type: 'fs',
      fileParts: [{ fieldName: "file", asset }],
      extraFields: {}
    });
    return { offlineSaved: true, message: "Saved offline. Will sync when connected." };
  }

  return uploadWithFileSystem(
    "/analyze",
    [{ fieldName: "file", asset }],
    {} // No extra form fields for /analyze
  );
}

/**
 * Compare two vehicle videos for similarity.
 *
 * Note: Because /compare requires TWO video files simultaneously,
 * we use the standard fetch-based multipart upload instead of
 * expo-file-system (which supports only 1 primary URI).
 * We still validate both files before submitting.
 *
 * @param {object} rawAssetA - First video asset
 * @param {object} rawAssetB - Second video asset
 * @returns {Promise<object>} Similarity comparison result
 */
export async function compareVehicles(rawAssetA, rawAssetB) {
  // Validate both videos concurrently
  const [{ asset: assetA, meta: metaA }, { asset: assetB, meta: metaB }] =
    await Promise.all([prepareForUpload(rawAssetA), prepareForUpload(rawAssetB)]);

  console.log(`[API] compareVehicles: A=${metaA.sizeMB || metaA.compressedMB}MB, B=${metaB.sizeMB || metaB.compressedMB}MB`);

  const formFields = [
    { type: "file",  key: "video_a", asset: assetA },
    { type: "file",  key: "video_b", asset: assetB },
  ];

  const isOnline = await checkOnline();
  if (!isOnline) {
    await enqueueSyncTask('/compare', {
      type: 'multipart',
      formFields,
    });
    return { offlineSaved: true, message: "Saved offline. Will sync when connected." };
  }

  return uploadMultipart("/compare", formFields);
}

/**
 * Estimate vehicle value from media + pricing info.
 *
 * @param {object} rawAsset      - Photo or video asset
 * @param {number} referencePrice
 * @param {number} [manufactureYear]
 * @param {number} [mileageKm]
 * @param {string} [currency]
 * @returns {Promise<object>} Valuation result
 */
export async function valuateVehicle(rawAsset, referencePrice, manufactureYear, mileageKm, currency = "IDR") {
  const { asset, meta } = await prepareForUpload(rawAsset);
  console.log(`[API] valuateVehicle: preparing upload`, meta);

  const extraFields = {
    reference_price: String(referencePrice),
    ...(manufactureYear ? { manufacture_year: String(manufactureYear) } : {}),
    ...(mileageKm       ? { mileage_km: String(mileageKm) }            : {}),
    ...(currency        ? { currency: currency.toUpperCase() }          : {}),
  };

  const isOnline = await checkOnline();
  if (!isOnline) {
    await enqueueSyncTask('/valuation', {
      type: 'fs',
      fileParts: [{ fieldName: "file", asset }],
      extraFields
    });
    return { offlineSaved: true, message: "Saved offline. Will sync when connected." };
  }

  return uploadWithFileSystem(
    "/valuation",
    [{ fieldName: "file", asset }],
    extraFields
  );
}


// ─────────────────────────────────────────────────────────
// Inspection Engine API (Stage 6 — async inspection flow)
// ─────────────────────────────────────────────────────────

/**
 * Submit a single vehicle video for async inspection.
 *
 * Returns immediately with { inspection_id, status: "pending", poll_url }.
 * Poll getInspectionStatus() every 3–5 seconds until status === "done" | "failed".
 *
 * Offline-aware: if no network, enqueues to SQLite sync_queue.
 *
 * @param {object}  rawAsset   - Asset from expo-document-picker (video)
 * @param {string}  [vehicleId] - Optional plate/VIN for tracking
 * @returns {Promise<object>}  { inspection_id, status, poll_url } or { offlineSaved: true }
 */
export async function inspectVehicle(rawAsset, vehicleId = null) {
  const { asset, meta } = await prepareForUpload(rawAsset);
  console.log(`[API] inspectVehicle: preparing upload`, meta);

  const extraFields = vehicleId ? { vehicle_id: vehicleId } : {};

  const isOnline = await checkOnline();
  if (!isOnline) {
    await enqueueSyncTask('/inspection/analyze', {
      type: 'fs',
      fileParts: [{ fieldName: "file", asset }],
      extraFields,
    });
    return { offlineSaved: true, message: "Saved offline. Will sync when connected." };
  }

  return uploadWithFileSystem(
    "/inspection/analyze",
    [{ fieldName: "file", asset }],
    extraFields,
  );
}

/**
 * Poll the lifecycle status of a submitted inspection.
 *
 * Safe to call every 3–5 seconds. Returns:
 *   { inspection_id, status, progress: { frames_analyzed, frames_total }, ... }
 *
 * Status values: "pending" → "processing" → "done" | "failed"
 *
 * @param {string} inspectionId
 * @returns {Promise<object>}
 */
export async function getInspectionStatus(inspectionId) {
  return request(`/inspection/status/${inspectionId}`);
}

/**
 * Fetch the full inspection result once status === "done".
 *
 * Returns the complete report including per-frame data, damage list,
 * condition score, and public frame image URLs.
 *
 * @param {string} inspectionId
 * @returns {Promise<object>}
 */
export async function getInspectionResult(inspectionId) {
  return request(`/inspection/result/${inspectionId}`);
}

/**
 * Fetch paginated inspection history for the authenticated user.
 *
 * Use on app open to restore history that may not be in local SQLite cache
 * (e.g. after reinstall or when using multiple devices).
 *
 * @param {number} [page=1]
 * @param {number} [perPage=20]
 * @returns {Promise<{ items: object[], total: number, page: number }>}
 */
export async function getInspectionHistory(page = 1, perPage = 20) {
  return request(`/inspection/history?page=${page}&per_page=${perPage}`);
}


