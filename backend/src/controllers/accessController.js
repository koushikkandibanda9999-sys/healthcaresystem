const { body, param } = require("express-validator");
const { validate }    = require("../middleware/validate");
const { v4: uuidv4 }  = require("uuid");
const AccessRequest   = require("../models/AccessRequest");
const MedicalRecord   = require("../models/MedicalRecord");
const User            = require("../models/User");
const Hospital        = require("../models/Hospital");
const blockchain      = require("../services/blockchainService");
const audit           = require("../services/auditService");
const { ethers }      = require("ethers");

// ── Validation rules ─────────────────────────────────────────

const requestAccessRules = [
  body("recordId").notEmpty().withMessage("recordId required"),
  body("requestedScope").optional().isString(),
  body("purpose").optional().isString().isLength({ max: 500 }),
];

const grantDenyRules = [
  param("id").notEmpty(),
  body("expiryTimestamp").optional().isNumeric().withMessage("expiryTimestamp must be a Unix timestamp (seconds)"),
];

// ── Helpers ──────────────────────────────────────────────────

function getPatientSigner(walletAddress) {
  // In this prototype the backend holds Hardhat test private keys mapped by address.
  // A production system would require the patient to sign with their MetaMask wallet.
  const provider = blockchain.getProvider();
  const key = process.env[`WALLET_KEY_${walletAddress.toLowerCase()}`];
  if (!key) throw new Error(`No signing key configured for patient wallet ${walletAddress}`);
  return new ethers.Wallet(key, provider);
}

function getHospitalSigner(blockchainAddress) {
  const provider = blockchain.getProvider();
  const key = process.env[`WALLET_KEY_${blockchainAddress.toLowerCase()}`];
  if (!key) throw new Error(`No signing key configured for hospital wallet ${blockchainAddress}`);
  return new ethers.Wallet(key, provider);
}

// ── Handlers ─────────────────────────────────────────────────

/** Hospital doctor or admin requests access to a record. */
async function requestAccess(req, res) {
  try {
    const { recordId, requestedScope = "*", purpose = "" } = req.body;
    const requester = req.user;

    const record = await MedicalRecord.findOne({ recordId, status: "active" });
    if (!record) return res.status(404).json({ error: "Record not found" });

    // Cannot request your own hospital's records
    if (String(record.hospitalId) === String(requester.hospitalId)) {
      return res.status(400).json({ error: "Cannot request access to your own hospital's record" });
    }

    const hospital = await Hospital.findById(requester.hospitalId);
    if (!hospital || !hospital.blockchainAddress) {
      return res.status(400).json({ error: "Requesting hospital has no blockchain address" });
    }

    // Check for duplicate pending request
    const existing = await AccessRequest.findOne({ recordId, requestingHospitalId: requester.hospitalId, status: "pending" });
    if (existing) return res.status(409).json({ error: "Pending request already exists" });

    // Submit on-chain
    let txHash = null;
    try {
      const hospitalSigner = getHospitalSigner(hospital.blockchainAddress);
      const result = await blockchain.requestAccess({ recordId, scope: requestedScope, hospitalSigner });
      txHash = result.txHash;
    } catch (err) {
      console.warn("[AccessController] requestAccess on-chain failed:", err.message);
      // Allow request to be created off-chain; blockchain can be retried
    }

    const accessReq = await AccessRequest.create({
      requestId: uuidv4(),
      recordId,
      requestingHospitalId: requester.hospitalId,
      requestingDoctorId: requester._id,
      patientId: record.patientId,
      requestedScope,
      purpose,
      status: "pending",
    });

    await audit.log({
      actorId: requester._id,
      actorRole: requester.role,
      hospitalId: requester.hospitalId,
      action: "ACCESS_REQUESTED",
      recordId,
      requestId: accessReq.requestId,
      blockchainTxHash: txHash,
      outcome: "success",
    });

    return res.status(201).json({ accessRequest: accessReq, blockchainTxHash: txHash });
  } catch (err) {
    console.error("[AccessController] requestAccess:", err.message);
    return res.status(500).json({ error: "Failed to create access request" });
  }
}

/** Patient gets their pending/active access requests. */
async function getAccessRequests(req, res) {
  try {
    const filter = {};
    if (req.user.role === "patient") {
      filter.patientId = req.user._id;
    } else if (req.user.role === "doctor" || req.user.role === "hospitalAdmin") {
      filter.requestingHospitalId = req.user.hospitalId;
    }
    // sysAdmin sees all

    const requests = await AccessRequest.find(filter)
      .populate("requestingHospitalId", "name code")
      .populate("requestingDoctorId", "name email")
      .populate("patientId", "name email")
      .sort({ requestedAt: -1 })
      .lean();

    return res.json({ accessRequests: requests });
  } catch (err) {
    console.error("[AccessController] getAccessRequests:", err.message);
    return res.status(500).json({ error: "Failed to fetch access requests" });
  }
}

/** Patient grants consent. */
async function grantAccess(req, res) {
  try {
    const { id }             = req.params;
    const { expiryTimestamp } = req.body;

    const accessReq = await AccessRequest.findOne({ requestId: id });
    if (!accessReq) return res.status(404).json({ error: "Access request not found" });
    if (String(accessReq.patientId) !== String(req.user._id)) {
      return res.status(403).json({ error: "Not your access request" });
    }
    if (accessReq.status !== "pending") {
      return res.status(400).json({ error: `Request is already ${accessReq.status}` });
    }

    const patient = req.user;
    if (!patient.walletAddress) {
      return res.status(400).json({ error: "Patient wallet address not configured" });
    }

    const hospital = await Hospital.findById(accessReq.requestingHospitalId);
    if (!hospital || !hospital.blockchainAddress) {
      return res.status(400).json({ error: "Requesting hospital has no blockchain address" });
    }

    let txHash = null;
    const expiry = expiryTimestamp ? Number(expiryTimestamp) : 0;
    try {
      const patientSigner = getPatientSigner(patient.walletAddress);
      const result = await blockchain.grantAccess({
        recordId: accessReq.recordId,
        requestingHospitalAddress: hospital.blockchainAddress,
        expiryTimestamp: expiry,
        patientSigner,
      });
      txHash = result.txHash;
    } catch (err) {
      console.warn("[AccessController] grantAccess on-chain failed:", err.message);
    }

    accessReq.status = "granted";
    accessReq.grantExpiry = expiry ? new Date(expiry * 1000) : null;
    accessReq.grantBlockchainTxHash = txHash;
    accessReq.resolvedAt = new Date();
    await accessReq.save();

    await audit.log({
      actorId: req.user._id,
      actorRole: "patient",
      action: "ACCESS_GRANTED",
      recordId: accessReq.recordId,
      requestId: id,
      blockchainTxHash: txHash,
      outcome: "success",
    });

    return res.json({ accessRequest: accessReq, blockchainTxHash: txHash });
  } catch (err) {
    console.error("[AccessController] grantAccess:", err.message);
    return res.status(500).json({ error: "Failed to grant access" });
  }
}

/** Patient denies consent. */
async function denyAccess(req, res) {
  try {
    const { id } = req.params;
    const accessReq = await AccessRequest.findOne({ requestId: id });
    if (!accessReq) return res.status(404).json({ error: "Access request not found" });
    if (String(accessReq.patientId) !== String(req.user._id)) {
      return res.status(403).json({ error: "Not your access request" });
    }
    if (accessReq.status !== "pending") {
      return res.status(400).json({ error: `Request is already ${accessReq.status}` });
    }

    const patient  = req.user;
    const hospital = await Hospital.findById(accessReq.requestingHospitalId);
    let txHash = null;
    try {
      const patientSigner = getPatientSigner(patient.walletAddress);
      const result = await blockchain.denyAccess({
        recordId: accessReq.recordId,
        requestingHospitalAddress: hospital.blockchainAddress,
        patientSigner,
      });
      txHash = result.txHash;
    } catch (err) {
      console.warn("[AccessController] denyAccess on-chain failed:", err.message);
    }

    accessReq.status = "denied";
    accessReq.resolvedAt = new Date();
    await accessReq.save();

    await audit.log({
      actorId: req.user._id,
      actorRole: "patient",
      action: "ACCESS_DENIED",
      recordId: accessReq.recordId,
      requestId: id,
      blockchainTxHash: txHash,
      outcome: "success",
    });

    return res.json({ accessRequest: accessReq, blockchainTxHash: txHash });
  } catch (err) {
    console.error("[AccessController] denyAccess:", err.message);
    return res.status(500).json({ error: "Failed to deny access" });
  }
}

/** Patient revokes a previously granted access. */
async function revokeAccess(req, res) {
  try {
    const { id } = req.params;
    const accessReq = await AccessRequest.findOne({ requestId: id });
    if (!accessReq) return res.status(404).json({ error: "Access grant not found" });
    if (String(accessReq.patientId) !== String(req.user._id)) {
      return res.status(403).json({ error: "Not your access grant" });
    }
    if (accessReq.status !== "granted") {
      return res.status(400).json({ error: "Access grant is not currently active" });
    }

    const patient  = req.user;
    const hospital = await Hospital.findById(accessReq.requestingHospitalId);
    let txHash = null;
    try {
      const patientSigner = getPatientSigner(patient.walletAddress);
      const result = await blockchain.revokeAccess({
        recordId: accessReq.recordId,
        requestingHospitalAddress: hospital.blockchainAddress,
        patientSigner,
      });
      txHash = result.txHash;
    } catch (err) {
      console.warn("[AccessController] revokeAccess on-chain failed:", err.message);
    }

    accessReq.status = "revoked";
    accessReq.revokeBlockchainTxHash = txHash;
    accessReq.resolvedAt = new Date();
    await accessReq.save();

    await audit.log({
      actorId: req.user._id,
      actorRole: "patient",
      action: "ACCESS_REVOKED",
      recordId: accessReq.recordId,
      requestId: id,
      blockchainTxHash: txHash,
      outcome: "success",
      detail: "REVOCATION_LIMITS: Does not erase copies previously downloaded by the authorized recipient",
    });

    return res.json({
      accessRequest: accessReq,
      blockchainTxHash: txHash,
      revocationNote: "Revocation prevents future authorized retrieval through this system. It cannot erase copies already downloaded by the authorized recipient.",
    });
  } catch (err) {
    console.error("[AccessController] revokeAccess:", err.message);
    return res.status(500).json({ error: "Failed to revoke access" });
  }
}

module.exports = {
  requestAccessRules,
  grantDenyRules,
  validate,
  requestAccess,
  getAccessRequests,
  grantAccess,
  denyAccess,
  revokeAccess,
};
