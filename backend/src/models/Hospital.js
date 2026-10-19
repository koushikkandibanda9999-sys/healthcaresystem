const mongoose = require("mongoose");

const hospitalSchema = new mongoose.Schema(
  {
    name:             { type: String, required: true, trim: true },
    code:             { type: String, required: true, unique: true, uppercase: true, trim: true },
    adminUserId:      { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    blockchainAddress: { type: String, default: null }, // EVM wallet address for this hospital
    isActive:         { type: Boolean, default: true },
    address:          { type: String, default: null },
    contactEmail:     { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Hospital", hospitalSchema);
