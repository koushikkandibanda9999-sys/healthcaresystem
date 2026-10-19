/**
 * Seed script — creates demo hospitals, users, and blockchain registrations.
 *
 * Usage:
 *   cd backend && node src/utils/seed.js
 *
 * This script uses the Hardhat mnemonic accounts. Ensure the local Hardhat
 * node is running: npx hardhat node
 * And the contract is deployed: npx hardhat run blockchain-scripts/deploy.js --network localhost
 *
 * HARDHAT TEST ACCOUNTS (mnemonic: test test test ... junk)
 *   #0  0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266  (deployer/owner/backend signer)
 *   #1  0x70997970C51812dc3A010C7d01b50e0d17dc79C8  (Hospital A wallet)
 *   #2  0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC  (Hospital B wallet)
 *   #3  0x90F79bf6EB2c4f870365E785982E1f101E93b906  (Doctor A wallet)
 *   #4  0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65  (Doctor B wallet)
 *   #5  0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc  (Patient wallet)
 */

require("dotenv").config({ path: require("path").join(__dirname, "../../../.env") });

const mongoose = require("mongoose");
const User      = require("../models/User");
const Hospital  = require("../models/Hospital");
const config    = require("../config");

// Hardhat test account addresses and private keys
const ACCOUNTS = {
  deployer: {
    address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    key:     "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  },
  hospitalA: {
    address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    key:     "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  },
  hospitalB: {
    address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    key:     "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  },
  doctorA: {
    address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    key:     "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
  },
  doctorB: {
    address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    key:     "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
  },
  patient: {
    address: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
    key:     "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
  },
};

async function seed() {
  try {
    await mongoose.connect(config.mongoUri);
    console.log("Connected to MongoDB");

    // ------ Hospitals ------
    let hospA = await Hospital.findOne({ code: "HOSPITAL_A" });
    if (!hospA) {
      hospA = await Hospital.create({
        name: "City General Hospital (Hospital A)",
        code: "HOSPITAL_A",
        blockchainAddress: ACCOUNTS.hospitalA.address,
        address: "123 Medical Ave, City, ST 10001",
        contactEmail: "admin@hospitala.example",
      });
      console.log("✓ Hospital A created:", hospA._id);
    } else {
      console.log("  Hospital A already exists");
    }

    let hospB = await Hospital.findOne({ code: "HOSPITAL_B" });
    if (!hospB) {
      hospB = await Hospital.create({
        name: "Metro Health Centre (Hospital B)",
        code: "HOSPITAL_B",
        blockchainAddress: ACCOUNTS.hospitalB.address,
        address: "456 Health Blvd, Metro, ST 20002",
        contactEmail: "admin@hospitalb.example",
      });
      console.log("✓ Hospital B created:", hospB._id);
    } else {
      console.log("  Hospital B already exists");
    }

    // ------ System Admin ------
    const sysAdminEmail = "sysadmin@healthcare.example";
    if (!await User.findOne({ email: sysAdminEmail })) {
      const ph = await User.hashPassword("SysAdmin@2024!");
      await User.create({
        name: "System Administrator",
        email: sysAdminEmail,
        passwordHash: ph,
        role: "sysAdmin",
        walletAddress: ACCOUNTS.deployer.address,
      });
      console.log("✓ System admin created:", sysAdminEmail);
    }

    // ------ Hospital A Admin ------
    const adminAEmail = "admin@hospitala.example";
    if (!await User.findOne({ email: adminAEmail })) {
      const ph = await User.hashPassword("HospA@dmin2024!");
      await User.create({
        name: "Hospital A Administrator",
        email: adminAEmail,
        passwordHash: ph,
        role: "hospitalAdmin",
        hospitalId: hospA._id,
      });
      console.log("✓ Hospital A admin created:", adminAEmail);
    }

    // ------ Hospital B Admin ------
    const adminBEmail = "admin@hospitalb.example";
    if (!await User.findOne({ email: adminBEmail })) {
      const ph = await User.hashPassword("HospB@dmin2024!");
      await User.create({
        name: "Hospital B Administrator",
        email: adminBEmail,
        passwordHash: ph,
        role: "hospitalAdmin",
        hospitalId: hospB._id,
      });
      console.log("✓ Hospital B admin created:", adminBEmail);
    }

    // ------ Doctor A (Hospital A) ------
    const doctorAEmail = "dr.johnson@hospitala.example";
    if (!await User.findOne({ email: doctorAEmail })) {
      const ph = await User.hashPassword("DrJohnson@2024!");
      await User.create({
        name: "Dr. Sarah Johnson",
        email: doctorAEmail,
        passwordHash: ph,
        role: "doctor",
        hospitalId: hospA._id,
        walletAddress: ACCOUNTS.doctorA.address,
      });
      console.log("✓ Doctor A created:", doctorAEmail);
    }

    // ------ Doctor B (Hospital B) ------
    const doctorBEmail = "dr.chen@hospitalb.example";
    if (!await User.findOne({ email: doctorBEmail })) {
      const ph = await User.hashPassword("DrChen@2024!");
      await User.create({
        name: "Dr. Michael Chen",
        email: doctorBEmail,
        passwordHash: ph,
        role: "doctor",
        hospitalId: hospB._id,
        walletAddress: ACCOUNTS.doctorB.address,
      });
      console.log("✓ Doctor B created:", doctorBEmail);
    }

    // ------ Patient ------
    const patientEmail = "emma.wilson@patient.example";
    if (!await User.findOne({ email: patientEmail })) {
      const ph = await User.hashPassword("Patient@2024!");
      await User.create({
        name: "Emma Wilson",
        email: patientEmail,
        passwordHash: ph,
        role: "patient",
        hospitalId: hospA._id,
        walletAddress: ACCOUNTS.patient.address,
        dateOfBirth: new Date("1985-06-15"),
        gender: "female",
        syntheaId: "synthea-emma-wilson-001",
      });
      console.log("✓ Patient created:", patientEmail);
    }

    console.log("\n=== Seed complete ===");
    console.log("Demo accounts:");
    console.log("  sysadmin@healthcare.example    / SysAdmin@2024!");
    console.log("  admin@hospitala.example        / HospA@dmin2024!");
    console.log("  admin@hospitalb.example        / HospB@dmin2024!");
    console.log("  dr.johnson@hospitala.example   / DrJohnson@2024!");
    console.log("  dr.chen@hospitalb.example      / DrChen@2024!");
    console.log("  emma.wilson@patient.example    / Patient@2024!");
    console.log("\nNext: Register hospitals on-chain via the system admin UI or API.");
    console.log("Ensure Hardhat node is running and CONTRACT_ADDRESS is set in .env");

  } catch (err) {
    console.error("Seed failed:", err);
  } finally {
    await mongoose.disconnect();
  }
}

seed();
