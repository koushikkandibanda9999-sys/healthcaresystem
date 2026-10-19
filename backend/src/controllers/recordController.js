const { body, param } = require("express-validator");
const { validate }    = require("../middleware/validate");
const { v4: uuidv4 }  = require("uuid");
const MedicalRecord   = require("../models/MedicalRecord");
const User            = require("../models/User");
const Hospital        = require("../models/Hospital");
const AccessRequest   = require("../models/AccessRequest");
const enc             = require("../services/encryptionService");
const storage         = require("../services/storageService");
const blockchain      = require("../services/blockchainService");
const audit           = require("../services/auditService");

// ── Validation rules ─────────────────────────────────────────

const createRecordRules = [
  body("patientId").notEmpty().isMongoId().withMessage("Valid patientId required"),
  body("recordType").trim().notEmpty().withMessage("recordType required"),
  body("recordCategory").trim().notEmpty().withMessage("recordCategory required"),
  body("content").isObject().withMessage("content must be an object"),
  body("encounterDate").optional().isISO8601(),
];

const verifyRecordRules = [
  param("id").notEmpty(),
];

// ── Helpers ──────────────────────────────────────────────────

/** Check whether the requesting user is authorized to access this record. */
async function checkReadAuthorization(record, requester) {
  // Patient can always view their own records
  if (requester.role === "patient") {
    return String(record.patientId) === String(requester._id);
  }
  // Doctor/hospitalAdmin from the owning hospital
  if (requester.role === "doctor" || requester.role === "hospitalAdmin") {
    if (String(record.hospitalId) === String(requester.hospitalId)) return true;
    // Or if there is an active granted access for their hospital
    const hospital = await Hospital.findById(requester.hospitalId);
    if (!hospital || !hospital.blockchainAddress) return false;
    try {
      return await blockchain.isAccessGranted(record.recordId, hospital.blockchainAddress);
    } catch (e) {
      return false;
    }
  }
  // sysAdmin can see metadata but NOT decrypted content (enforced in handler)
  if (requester.role === "sysAdmin") return true;
  return false;
}

// ── Handlers ─────────────────────────────────────────────────

async function createRecord(req, res) {
  try {
    const { patientId, recordType, recordCategory, content, encounterDate } = req.body;
    const doctor   = req.user;
    const hospital = await Hospital.findById(doctor.hospitalId);

    if (!hospital) return res.status(400).json({ error: "Doctor not associated with a hospital" });

    // Validate patient exists and is active
    const patient = await User.findOne({ _id: patientId, role: "patient", isActive: true });
    if (!patient) return res.status(404).json({ error: "Patient not found" });
    if (!patient.walletAddress) return res.status(400).json({ error: "Patient has no registered wallet address" });
    if (!hospital.blockchainAddress) return res.status(400).json({ error: "Hospital has no registered blockchain address" });

    const recordId = uuidv4();
    const now = new Date().toISOString();

    // Build canonical record (no free-text PHI in the fields stored in DB)
    const recordPayload = {
      recordId,
      patientId:    String(patient._id),
      hospitalId:   String(hospital._id),
      doctorId:     String(doctor._id),
      recordType:   recordType.toUpperCase(),
      recordCategory: recordCategory.toUpperCase(),
      encounterDate: encounterDate || null,
      createdAt:    now,
      content,       // clinical fields — stays off-chain / encrypted
    };

    // 1. Canonicalize
    const canonicalJson = enc.canonicalizeRecord(recordPayload);

    // 2. Compute SHA-256 hash
    const contentHash = enc.computeHash(canonicalJson);

    // 3. Encrypt
    const envelope = enc.encrypt(canonicalJson);

    // 4. Store off-chain
    const storageRef = await storage.save(recordId, envelope);

    // 5. Register on-chain (backend signer acts as the doctor's delegated account)
    //    In a full dApp the doctor's MetaMask wallet would sign instead.
    let txHash = null;
    try {
      const onChain = await blockchain.registerRecord({
        recordId,
        contentHash,
        patientAddress:  patient.walletAddress,
        hospitalAddress: hospital.blockchainAddress,
        recordCategory:  recordCategory.toUpperCase(),
      });
      txHash = onChain.txHash;
    } catch (err) {
      console.warn("[RecordController] Blockchain registration failed:", err.message);
      // Continue — record is saved off-chain; blockchain registration can be retried
    }

    // 6. Save metadata to DB
    const dbRecord = await MedicalRecord.create({
      recordId,
      patientId: patient._id,
      hospitalId: hospital._id,
      doctorId: doctor._id,
      recordType: recordType.toUpperCase(),
      recordCategory: recordCategory.toUpperCase(),
      contentHash,
      storageRef,
      blockchainTxHash: txHash,
      encounterDate: encounterDate ? new Date(encounterDate) : null,
    });

    await audit.log({
      actorId: doctor._id,
      actorRole: doctor.role,
      hospitalId: hospital._id,
      action: "RECORD_CREATED",
      recordId,
      blockchainTxHash: txHash,
      outcome: "success",
      detail: `type=${recordType} category=${recordCategory}`,
    });

    return res.status(201).json({
      recordId,
      contentHash,
      blockchainTxHash: txHash,
      message: "Record created, encrypted, and registered",
    });
  } catch (err) {
    console.error("[RecordController] createRecord:", err.message);
    return res.status(500).json({ error: "Failed to create record" });
  }
}

async function getRecord(req, res) {
  try {
    const record = await MedicalRecord.findOne({ recordId: req.params.id, status: "active" })
      .populate("patientId", "name email")
      .populate("hospitalId", "name code")
      .populate("doctorId", "name");

    if (!record) return res.status(404).json({ error: "Record not found" });

    const authorized = await checkReadAuthorization(record, req.user);
    if (!authorized) {
      await audit.log({
        actorId: req.user._id,
        actorRole: req.user.role,
        action: "RECORD_ACCESS_DENIED",
        recordId: record.recordId,
        outcome: "failure",
      });
      return res.status(403).json({ error: "Access denied" });
    }

    // sysAdmin sees metadata only — not the decrypted clinical content
    if (req.user.role === "sysAdmin") {
      return res.json({ record: record.toObject(), decryptedContent: null, note: "SysAdmin cannot view clinical content" });
    }

    // Retrieve and decrypt
    const envelope   = await storage.load(record.storageRef);
    const plaintext  = enc.decrypt(envelope);

    // Verify integrity
    const verification = enc.verifyHash(plaintext, record.contentHash);

    let parsed;
    try { parsed = JSON.parse(plaintext); } catch { parsed = null; }

    await audit.log({
      actorId: req.user._id,
      actorRole: req.user.role,
      hospitalId: req.user.hospitalId,
      action: "RECORD_ACCESSED",
      recordId: record.recordId,
      outcome: "success",
    });

    return res.json({
      record:           record.toObject(),
      decryptedContent: parsed?.content ?? parsed,
      verification,
    });
  } catch (err) {
    console.error("[RecordController] getRecord:", err.message);
    return res.status(500).json({ error: "Failed to retrieve record" });
  }
}

async function verifyRecord(req, res) {
  try {
    const record = await MedicalRecord.findOne({ recordId: req.params.id, status: "active" });
    if (!record) return res.status(404).json({ error: "Record not found" });

    const authorized = await checkReadAuthorization(record, req.user);
    if (!authorized) return res.status(403).json({ error: "Access denied" });

    // Load and decrypt
    const envelope  = await storage.load(record.storageRef);
    const plaintext = enc.decrypt(envelope);

    // Off-chain hash check
    const offChain = enc.verifyHash(plaintext, record.contentHash);

    // On-chain hash check
    let onChainMatch = null;
    try {
      onChainMatch = await blockchain.checkRecordHash(record.recordId, record.contentHash);
    } catch (e) {
      console.warn("[RecordController] On-chain verify failed:", e.message);
    }

    const result = {
      recordId:      record.recordId,
      offChain:      offChain,
      onChainMatch,
      overallVerified: offChain.verified && (onChainMatch !== false),
      message: offChain.verified ? "Record integrity verified" : "INTEGRITY CHECK FAILED — record may have been tampered",
    };

    await audit.log({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "RECORD_VERIFIED",
      recordId: record.recordId,
      outcome: offChain.verified ? "success" : "failure",
      detail: `verified=${offChain.verified}`,
    });

    return res.json(result);
  } catch (err) {
    console.error("[RecordController] verifyRecord:", err.message);
    return res.status(500).json({ error: "Verification failed" });
  }
}

async function getPatientRecords(req, res) {
  try {
    const targetPatientId = req.params.patientId || req.user._id;

    // Patients can only see their own
    if (req.user.role === "patient" && String(req.user._id) !== String(targetPatientId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const records = await MedicalRecord.find({ patientId: targetPatientId, status: "active" })
      .populate("hospitalId", "name code")
      .populate("doctorId", "name")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ records });
  } catch (err) {
    console.error("[RecordController] getPatientRecords:", err.message);
    return res.status(500).json({ error: "Failed to fetch records" });
  }
}

module.exports = {
  createRecordRules,
  verifyRecordRules,
  validate,
  createRecord,
  getRecord,
  verifyRecord,
  getPatientRecords,
};
