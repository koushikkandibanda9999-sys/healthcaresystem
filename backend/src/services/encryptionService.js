/**
 * Encryption service — AES-256-GCM
 *
 * Design notes:
 * - Each record gets a unique random 12-byte IV (nonce).
 * - The GCM authentication tag (16 bytes) is stored alongside.
 * - The symmetric key is loaded from the RECORD_ENCRYPTION_KEY env var.
 *   In production this key MUST come from a KMS/HSM, not a static env variable.
 * - The IV and auth tag are stored with the ciphertext (not on-chain).
 * - This module NEVER logs plaintext content, keys, or IVs.
 *
 * Canonical JSON
 * --------------
 * Before hashing or encrypting a record, callers must canonicalize it with
 * canonicalizeRecord() to ensure stable field ordering and no extra whitespace.
 * This prevents false hash mismatches due to key-ordering differences.
 */

const crypto = require("crypto");
const config = require("../config");

const ALGORITHM = "aes-256-gcm";
const IV_BYTES  = 12;  // 96-bit IV recommended for GCM
const TAG_BYTES = 16;

function getKey() {
  const hex = config.recordEncKey;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "RECORD_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). " +
      "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return Buffer.from(hex, "hex");
}

/**
 * Canonicalize a record object to a stable JSON string.
 * Keys are sorted recursively; values are left unchanged.
 */
function canonicalizeRecord(record) {
  function sortKeys(obj) {
    if (Array.isArray(obj))           return obj.map(sortKeys);
    if (obj !== null && typeof obj === "object") {
      const sorted = {};
      Object.keys(obj).sort().forEach((k) => { sorted[k] = sortKeys(obj[k]); });
      return sorted;
    }
    return obj;
  }
  return JSON.stringify(sortKeys(record));
}

/**
 * Compute SHA-256 hash of the canonical plaintext.
 * @param {string} canonicalJson — output of canonicalizeRecord()
 * @returns {string} hex string (64 chars)
 */
function computeHash(canonicalJson) {
  return crypto.createHash("sha256").update(canonicalJson, "utf8").digest("hex");
}

/**
 * Encrypt the canonical JSON string.
 * @param {string} canonicalJson
 * @returns {{ iv: string, tag: string, ciphertext: string }} all hex strings
 */
function encrypt(canonicalJson) {
  const key = getKey();
  const iv  = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const enc1 = cipher.update(canonicalJson, "utf8");
  const enc2 = cipher.final();
  const tag  = cipher.getAuthTag();

  return {
    iv:         iv.toString("hex"),
    tag:        tag.toString("hex"),
    ciphertext: Buffer.concat([enc1, enc2]).toString("hex"),
  };
}

/**
 * Decrypt a stored record envelope.
 * @param {{ iv: string, tag: string, ciphertext: string }} envelope
 * @returns {string} canonical JSON plaintext
 */
function decrypt(envelope) {
  const key    = getKey();
  const iv     = Buffer.from(envelope.iv, "hex");
  const tag    = Buffer.from(envelope.tag, "hex");
  const cipher = Buffer.from(envelope.ciphertext, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const dec1 = decipher.update(cipher);
  const dec2 = decipher.final();
  return Buffer.concat([dec1, dec2]).toString("utf8");
}

/**
 * Verify that the decrypted content hash matches the registered hash.
 * @param {string} decryptedJson — canonical JSON after decryption
 * @param {string} registeredHash — hex hash stored in DB / on-chain
 * @returns {{ verified: boolean, computedHash: string }}
 */
function verifyHash(decryptedJson, registeredHash) {
  const computedHash = computeHash(decryptedJson);
  return {
    verified:     computedHash === registeredHash,
    computedHash,
    registeredHash,
  };
}

module.exports = { canonicalizeRecord, computeHash, encrypt, decrypt, verifyHash };
