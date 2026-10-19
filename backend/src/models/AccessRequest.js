const mongoose = require("mongoose");

const accessRequestSchema = new mongoose.Schema(
  {
    // Application-level UUID for this request
    requestId: { type: String, required: true, unique: true },

    recordId:              { type: String, required: true }, // matches MedicalRecord.recordId
    requestingHospitalId:  { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },
    requestingDoctorId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    patientId:             { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    requestedScope: { type: String, default: "*" },
    purpose:        { type: String, default: "" },

    status: {
      type: String,
      enum: ["pending", "granted", "denied", "revoked", "expired"],
      default: "pending",
    },

    // Populated when granted
    grantExpiry:          { type: Date, default: null },
    grantBlockchainTxHash: { type: String, default: null },
    revokeBlockchainTxHash: { type: String, default: null },

    requestedAt:  { type: Date, default: Date.now },
    resolvedAt:   { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AccessRequest", accessRequestSchema);
