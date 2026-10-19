const User          = require("../models/User");
const MedicalRecord = require("../models/MedicalRecord");
const AccessRequest = require("../models/AccessRequest");

async function getMyProfile(req, res) {
  return res.json({ user: req.user });
}

async function getMyRecords(req, res) {
  try {
    const records = await MedicalRecord.find({ patientId: req.user._id, status: "active" })
      .populate("hospitalId", "name code")
      .populate("doctorId", "name")
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ records });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch records" });
  }
}

async function getMyAccessRequests(req, res) {
  try {
    const requests = await AccessRequest.find({ patientId: req.user._id })
      .populate("requestingHospitalId", "name code")
      .populate("requestingDoctorId", "name email")
      .sort({ requestedAt: -1 })
      .lean();
    return res.json({ accessRequests: requests });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch access requests" });
  }
}

async function updateWalletAddress(req, res) {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress || !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }
    await User.findByIdAndUpdate(req.user._id, { walletAddress });
    return res.json({ message: "Wallet address updated" });
  } catch (err) {
    return res.status(500).json({ error: "Failed to update wallet address" });
  }
}

async function getUsers(req, res) {
  try {
    const { role, hospitalId } = req.query;
    const filter = { isActive: true };
    if (role) filter.role = role;
    if (hospitalId) filter.hospitalId = hospitalId;
    const users = await User.find(filter).select("-passwordHash").lean();
    return res.json({ users });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch users" });
  }
}

module.exports = { getMyProfile, getMyRecords, getMyAccessRequests, updateWalletAddress, getUsers };
