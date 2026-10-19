/**
 * One-time bootstrap seeder endpoint.
 * Only works when zero sysAdmin users exist (first-run only).
 * After the first sysAdmin is created, this endpoint returns 403.
 */
const express  = require("express");
const router   = express.Router();
const User     = require("../models/User");
const Hospital = require("../models/Hospital");
const { signToken } = require("../middleware/auth");

router.post("/", async (req, res) => {
  try {
    // Only allow if no sysAdmin exists yet
    const existingSysAdmin = await User.findOne({ role: "sysAdmin" });
    if (existingSysAdmin) {
      return res.status(403).json({ error: "Already seeded. Use normal login." });
    }

    const ACCOUNTS = {
      hospitalA: { address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" },
      hospitalB: { address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" },
      doctorA:   { address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906" },
      doctorB:   { address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65" },
      patient:   { address: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc" },
      deployer:  { address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" },
    };

    // Create hospitals
    const hospA = await Hospital.findOneAndUpdate(
      { code: "HOSPITAL_A" },
      { name: "City General Hospital (Hospital A)", code: "HOSPITAL_A", blockchainAddress: ACCOUNTS.hospitalA.address, isActive: true },
      { upsert: true, new: true }
    );
    const hospB = await Hospital.findOneAndUpdate(
      { code: "HOSPITAL_B" },
      { name: "Metro Health Centre (Hospital B)", code: "HOSPITAL_B", blockchainAddress: ACCOUNTS.hospitalB.address, isActive: true },
      { upsert: true, new: true }
    );

    // Helper to create user if not exists
    async function createUser(data) {
      const exists = await User.findOne({ email: data.email });
      if (exists) return exists;
      const ph = await User.hashPassword(data.password);
      return User.create({ ...data, passwordHash: ph });
    }

    const sysAdmin = await createUser({ name: "System Administrator",      email: "sysadmin@healthcare.example",  password: "SysAdmin@2024!",   role: "sysAdmin",      walletAddress: ACCOUNTS.deployer.address });
    await createUser({ name: "Hospital A Administrator",    email: "admin@hospitala.example",      password: "HospA@dmin2024!",  role: "hospitalAdmin", hospitalId: hospA._id });
    await createUser({ name: "Hospital B Administrator",    email: "admin@hospitalb.example",      password: "HospB@dmin2024!",  role: "hospitalAdmin", hospitalId: hospB._id });
    await createUser({ name: "Dr. Sarah Johnson",           email: "dr.johnson@hospitala.example", password: "DrJohnson@2024!",  role: "doctor",        hospitalId: hospA._id, walletAddress: ACCOUNTS.doctorA.address });
    await createUser({ name: "Dr. Michael Chen",            email: "dr.chen@hospitalb.example",    password: "DrChen@2024!",     role: "doctor",        hospitalId: hospB._id, walletAddress: ACCOUNTS.doctorB.address });
    await createUser({ name: "Emma Wilson",                 email: "emma.wilson@patient.example",  password: "Patient@2024!",    role: "patient",       hospitalId: hospA._id, walletAddress: ACCOUNTS.patient.address, dateOfBirth: new Date("1985-06-15"), gender: "female" });

    const token = signToken(sysAdmin._id, sysAdmin.role);

    return res.status(201).json({
      message: "Demo accounts seeded successfully!",
      token,
      accounts: [
        { role: "sysAdmin",      email: "sysadmin@healthcare.example",  password: "SysAdmin@2024!" },
        { role: "hospitalAdmin", email: "admin@hospitala.example",      password: "HospA@dmin2024!" },
        { role: "hospitalAdmin", email: "admin@hospitalb.example",      password: "HospB@dmin2024!" },
        { role: "doctor",        email: "dr.johnson@hospitala.example", password: "DrJohnson@2024!" },
        { role: "doctor",        email: "dr.chen@hospitalb.example",    password: "DrChen@2024!" },
        { role: "patient",       email: "emma.wilson@patient.example",  password: "Patient@2024!" },
      ],
      hospitals: [
        { name: "City General Hospital (Hospital A)", code: "HOSPITAL_A" },
        { name: "Metro Health Centre (Hospital B)",   code: "HOSPITAL_B" },
      ],
    });
  } catch (err) {
    console.error("[Seed]", err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
