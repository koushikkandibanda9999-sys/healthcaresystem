const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const ROLES = ["patient", "doctor", "hospitalAdmin", "sysAdmin"];

const userSchema = new mongoose.Schema(
  {
    name:          { type: String, required: true, trim: true, maxlength: 120 },
    email:         { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash:  { type: String, required: true },
    role:          { type: String, enum: ROLES, required: true },
    hospitalId:    { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", default: null },
    walletAddress: { type: String, default: null },
    isActive:      { type: Boolean, default: true },
    // Patient-specific synthetic data fields (populated from Synthea import)
    dateOfBirth:   { type: Date, default: null },
    gender:        { type: String, default: null },
    syntheaId:     { type: String, default: null }, // source patient UUID
  },
  { timestamps: true }
);

// Never return passwordHash in JSON
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

userSchema.methods.verifyPassword = async function (plaintext) {
  return bcrypt.compare(plaintext, this.passwordHash);
};

userSchema.statics.hashPassword = async function (plaintext) {
  return bcrypt.hash(plaintext, 12);
};

module.exports = mongoose.model("User", userSchema);
