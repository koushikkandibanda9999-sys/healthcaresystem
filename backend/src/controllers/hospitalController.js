const { body }    = require("express-validator");
const { validate } = require("../middleware/validate");
const Hospital    = require("../models/Hospital");
const User        = require("../models/User");
const blockchain  = require("../services/blockchainService");
const audit       = require("../services/auditService");

const registerHospitalRules = [
  body("name").trim().notEmpty(),
  body("code").trim().notEmpty().toUpperCase(),
  body("blockchainAddress").optional().isEthereumAddress(),
  body("address").optional().isString(),
  body("contactEmail").optional().isEmail(),
];

async function registerHospital(req, res) {
  try {
    const { name, code, blockchainAddress, address, contactEmail } = req.body;

    const existing = await Hospital.findOne({ code: code.toUpperCase() });
    if (existing) return res.status(409).json({ error: "Hospital code already registered" });

    const hospital = await Hospital.create({ name, code: code.toUpperCase(), blockchainAddress, address, contactEmail });

    // Register on-chain if address provided
    let txHash = null;
    if (blockchainAddress) {
      try {
        const result = await blockchain.registerHospital(blockchainAddress, name);
        txHash = result.txHash;
      } catch (err) {
        console.warn("[HospitalController] On-chain registration failed:", err.message);
      }
    }

    await audit.log({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "HOSPITAL_REGISTERED",
      blockchainTxHash: txHash,
      outcome: "success",
      detail: `code=${code}`,
    });

    return res.status(201).json({ hospital, blockchainTxHash: txHash });
  } catch (err) {
    console.error("[HospitalController] registerHospital:", err.message);
    return res.status(500).json({ error: "Failed to register hospital" });
  }
}

async function getHospitals(req, res) {
  try {
    const hospitals = await Hospital.find({ isActive: true }).lean();
    return res.json({ hospitals });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch hospitals" });
  }
}

async function getHospital(req, res) {
  try {
    const hospital = await Hospital.findById(req.params.id);
    if (!hospital) return res.status(404).json({ error: "Hospital not found" });
    return res.json({ hospital });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch hospital" });
  }
}

async function getHospitalDoctors(req, res) {
  try {
    const doctors = await User.find({ hospitalId: req.params.id, role: "doctor", isActive: true })
      .select("-passwordHash")
      .lean();
    return res.json({ doctors });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch doctors" });
  }
}

module.exports = {
  registerHospitalRules,
  validate,
  registerHospital,
  getHospitals,
  getHospital,
  getHospitalDoctors,
};
