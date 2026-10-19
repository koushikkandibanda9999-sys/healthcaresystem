const mongoose = require("mongoose");

/**
 * Application-layer metadata for a medical record.
 * The actual medical content is stored encrypted off-chain.
 * The content hash and record reference are registered on-chain.
 *
 * NOTHING in this document contains decrypted medical content
 * or encryption keys.
 */
const medicalRecordSchema = new mongoose.Schema(
  {
    // Off-chain UUID — also used as bytes32 on-chain (hex-padded)
    recordId:       { type: String, required: true, unique: true },

    // References
    patientId:      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    hospitalId:     { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },
    doctorId:       { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Record classification
    recordType:     { type: String, required: true },     // e.g. "ENCOUNTER"
    recordCategory: { type: String, required: true },     // normalized category

    // Integrity — SHA-256 of canonical plaintext JSON before encryption
    contentHash:    { type: String, required: true },

    // Off-chain storage pointer (relative path inside STORAGE_PATH)
    storageRef:     { type: String, required: true },

    // On-chain anchoring
    blockchainTxHash: { type: String, default: null },
    onChainIndex:     { type: Number, default: null },

    // Lifecycle
    status:    { type: String, enum: ["active", "archived", "deleted"], default: "active" },

    // Encounter date (from the clinical data, not the upload timestamp)
    encounterDate: { type: Date, default: null },

    // Source tracing (Synthea import)
    syntheaEncounterId: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MedicalRecord", medicalRecordSchema);
