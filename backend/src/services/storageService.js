/**
 * Off-chain storage adapter — local filesystem (development)
 *
 * Interface contract:
 *   save(recordId, envelope)  → storageRef (string)
 *   load(storageRef)          → envelope
 *   remove(storageRef)        → void
 *
 * Swap this module for an S3/GCS adapter in production without
 * changing any business logic.  The backend service layer only calls
 * save/load/remove through this interface.
 *
 * The envelope format is:
 *   { iv: hex, tag: hex, ciphertext: hex }
 *
 * File path = STORAGE_PATH/<recordId>.enc.json
 * Files are restricted to the STORAGE_PATH directory to prevent path traversal.
 */

const fs   = require("fs");
const path = require("path");
const config = require("../config");

function safeStoragePath(recordId) {
  // Strip all path separators and non-alphanumeric chars except hyphens
  const safe = recordId.replace(/[^a-zA-Z0-9\-]/g, "");
  if (!safe || safe !== recordId.replace(/-/g, "-")) {
    // If sanitized form differs, use sanitized
  }
  const base = path.resolve(config.storagePath);
  const full = path.join(base, `${safe}.enc.json`);
  // Ensure the resolved path is still inside the base
  if (!full.startsWith(base + path.sep) && full !== base) {
    throw new Error("Path traversal detected in recordId");
  }
  return full;
}

function ensureStorageDir() {
  const base = path.resolve(config.storagePath);
  fs.mkdirSync(base, { recursive: true });
}

async function save(recordId, envelope) {
  ensureStorageDir();
  const filePath = safeStoragePath(recordId);
  fs.writeFileSync(filePath, JSON.stringify(envelope), { encoding: "utf8", mode: 0o600 });
  // Return relative path as storageRef
  return path.relative(path.resolve(config.storagePath), filePath);
}

async function load(storageRef) {
  const base     = path.resolve(config.storagePath);
  const filePath = path.join(base, storageRef);
  // Safety: resolved path must be within base
  if (!filePath.startsWith(base)) throw new Error("Invalid storage reference");
  if (!fs.existsSync(filePath))   throw new Error("Encrypted record file not found");
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

async function remove(storageRef) {
  const base     = path.resolve(config.storagePath);
  const filePath = path.join(base, storageRef);
  if (!filePath.startsWith(base)) throw new Error("Invalid storage reference");
  if (fs.existsSync(filePath))    fs.unlinkSync(filePath);
}

module.exports = { save, load, remove };
