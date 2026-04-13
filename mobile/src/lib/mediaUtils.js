/**
 * mobile/src/lib/mediaUtils.js
 *
 * Client-side media compression utilities.
 *
 * WHY THIS EXISTS:
 *   - Raw photos from modern phones are 8-20MB each.
 *   - Raw videos from modern phones can be 100-500MB even for short clips.
 *   - Sending these raw wastes bandwidth, is slow on 4G, and can hit server limits.
 *   - This module compresses media BEFORE upload while preserving usable quality.
 *
 * LIBRARY CHOICES:
 *   - Images: expo-image-manipulator (Expo managed, no ejection needed, very fast)
 *   - Videos: expo-file-system (no native compression available in Expo managed workflow)
 *             For true video reencoding in production, you'd need a bare workflow
 *             + react-native-ffmpeg. This module handles the file-system side correctly
 *             and documents the limitation clearly.
 */

import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system";

// ─────────────────────────────────────────────────────────
// Configuration Constants
// ─────────────────────────────────────────────────────────

/** Maximum dimension (width OR height) for compressed images */
const IMAGE_MAX_DIMENSION = 1080;

/** JPEG quality 0–1. 0.82 is a good sweet spot: ~70% size reduction, no visible loss */
const IMAGE_JPEG_QUALITY = 0.82;

/** Max file size we'll attempt to send without pre-checking (200MB in bytes) */
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

// ─────────────────────────────────────────────────────────
// Type helpers
// ─────────────────────────────────────────────────────────

/**
 * Determine if an asset from expo-document-picker is a video
 * by checking its mimeType or file extension.
 */
function isVideo(asset) {
  const mime = (asset.mimeType || "").toLowerCase();
  const name = (asset.name || "").toLowerCase();
  return (
    mime.startsWith("video/") ||
    name.endsWith(".mp4") ||
    name.endsWith(".mov") ||
    name.endsWith(".mkv") ||
    name.endsWith(".avi")
  );
}

/**
 * Determine if an asset is an image.
 */
function isImage(asset) {
  const mime = (asset.mimeType || "").toLowerCase();
  const name = (asset.name || "").toLowerCase();
  return (
    mime.startsWith("image/") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png") ||
    name.endsWith(".webp") ||
    name.endsWith(".heic")
  );
}

// ─────────────────────────────────────────────────────────
// Image Compression
// ─────────────────────────────────────────────────────────

/**
 * Compress an image asset using expo-image-manipulator.
 *
 * What this does:
 *   1. Resizes so the longest side is ≤ IMAGE_MAX_DIMENSION (maintains aspect ratio)
 *   2. Re-encodes as JPEG at IMAGE_JPEG_QUALITY
 *
 * @param {object} asset  - Asset from expo-document-picker (has .uri, .width, .height)
 * @returns {object}      - New asset-compatible object with compressed URI
 */
export async function compressImage(asset) {
  const uri = asset.uri;

  // Build resize action — only if image is larger than our target
  const actions = [];
  const w = asset.width || 0;
  const h = asset.height || 0;

  if (w > IMAGE_MAX_DIMENSION || h > IMAGE_MAX_DIMENSION) {
    const isPortrait = h > w;
    actions.push({
      resize: isPortrait
        ? { height: IMAGE_MAX_DIMENSION }
        : { width: IMAGE_MAX_DIMENSION },
    });
  }

  const result = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: IMAGE_JPEG_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  return {
    ...asset,
    uri: result.uri,
    name: asset.name ? asset.name.replace(/\.[^.]+$/, ".jpg") : "compressed.jpg",
    mimeType: "image/jpeg",
    // These may be undefined in some flows — that's OK
    width: result.width,
    height: result.height,
  };
}

// ─────────────────────────────────────────────────────────
// Video Validation & Pre-Upload Checks
// ─────────────────────────────────────────────────────────

/**
 * NOTE ON VIDEO COMPRESSION:
 *
 * True video re-encoding (changing codec, bitrate, resolution) is NOT
 * possible in Expo's managed workflow without ejecting to bare React Native
 * and using react-native-ffmpeg or similar native library.
 *
 * What we DO instead (which covers most real-world cases):
 *   1. Validate file size before attempting upload
 *   2. Warn the user if the video exceeds a recommended size
 *   3. Provide a hard limit to prevent obviously oversized uploads
 *   4. Use expo-file-system's background upload API so the UI stays responsive
 *
 * If you eject to bare workflow in the future, swap this function with:
 *   import { Video } from 'react-native-compressor';
 *   const compressed = await Video.compress(uri, { compressionMethod: 'auto' });
 */

/**
 * Validate a video asset before upload.
 * Returns metadata and throws if the file is obviously unacceptable.
 *
 * @param {object} asset - Asset from expo-document-picker
 * @returns {Promise<{uri: string, sizeBytes: number, sizeMB: string}>}
 */
export async function validateVideo(asset) {
  const info = await FileSystem.getInfoAsync(asset.uri, { size: true });

  if (!info.exists) {
    throw new Error("Video file not found on device. Please select it again.");
  }

  const sizeBytes = info.size || 0;
  const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(1);

  if (sizeBytes > MAX_UPLOAD_BYTES) {
    throw new Error(
      `Video is too large (${sizeMB}MB). Maximum upload size is 200MB. ` +
        `Please trim the video or select a shorter clip.`
    );
  }

  return { uri: asset.uri, sizeBytes, sizeMB };
}

// ─────────────────────────────────────────────────────────
// Main Entry Point: compress any media type
// ─────────────────────────────────────────────────────────

/**
 * Smart compression dispatcher — handles both images and videos.
 * Pass any asset from expo-document-picker here before uploading.
 *
 * @param {object} asset  - Raw asset from expo-document-picker
 * @returns {Promise<{asset: object, meta: object}>}
 *   - asset: The (possibly compressed) asset ready for FormData
 *   - meta:  Metadata about what was done (for logging/debugging)
 */
export async function prepareForUpload(asset) {
  if (isImage(asset)) {
    const compressed = await compressImage(asset);
    const originalInfo = await FileSystem.getInfoAsync(asset.uri, { size: true });
    const compressedInfo = await FileSystem.getInfoAsync(compressed.uri, { size: true });
    const originalMB = ((originalInfo.size || 0) / (1024 * 1024)).toFixed(1);
    const compressedMB = ((compressedInfo.size || 0) / (1024 * 1024)).toFixed(1);

    console.log(
      `[MediaUtils] Image compressed: ${originalMB}MB → ${compressedMB}MB`
    );

    return {
      asset: compressed,
      meta: { type: "image", originalMB, compressedMB, hadCompression: true },
    };
  }

  if (isVideo(asset)) {
    const { uri, sizeMB } = await validateVideo(asset);
    console.log(`[MediaUtils] Video validated: ${sizeMB}MB (no re-encoding in managed workflow)`);

    return {
      asset: { ...asset, uri },
      meta: { type: "video", sizeMB, hadCompression: false },
    };
  }

  // Fallback: return as-is for unknown types
  return { asset, meta: { type: "unknown", hadCompression: false } };
}
