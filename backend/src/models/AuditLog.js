const mongoose = require("mongoose");

/**
 * Privacy-aware audit log.
 * Store only identifiers and action codes — never clinical content,
 * encryption keys, or decrypted record bytes.
 */
const auditLogSchema = new mongoose.Schema(
  {
    actorId:          { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    actorRole:        { type: String, default: null },
    hospitalId:       { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", default: null },
    action:           { type: String, required: true }, // e.g. "RECORD_CREATED", "ACCESS_GRANTED"
    recordId:         { type: String, default: null },
    requestId:        { type: String, default: null },
    outcome:          { type: String, enum: ["success", "failure", "info"], default: "success" },
    blockchainTxHash: { type: String, default: null },
    // Privacy-scrubbed detail string (no PHI)
    detail:           { type: String, default: null },
  },
  {
    timestamps: true,
    // Immutable — no updates allowed after creation
  }
);

// Prevent updates (audit logs are append-only)
auditLogSchema.pre(["updateOne", "findOneAndUpdate", "updateMany"], function () {
  throw new Error("Audit logs are immutable");
});

module.exports = mongoose.model("AuditLog", auditLogSchema);
