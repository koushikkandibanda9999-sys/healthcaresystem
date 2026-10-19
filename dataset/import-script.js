/**
 * Synthetic Dataset Import Script
 *
 * Imports encounters from dataset/synthetic/synthea_sample.json into MongoDB
 * as encrypted medical records, creating blockchain registrations for each.
 *
 * Prerequisites:
 *   1. MongoDB running and MONGO_URI set in .env
 *   2. Hardhat node running: npx hardhat node
 *   3. Contract deployed: npx hardhat run blockchain-scripts/deploy.js --network localhost
 *   4. Seed accounts exist: cd backend && node src/utils/seed.js
 *   5. CONTRACT_ADDRESS and BACKEND_SIGNER_PRIVATE_KEY set in .env
 *
 * Usage:
 *   node dataset/import-script.js
 */

require("dotenv").config();
const mongoose  = require("mongoose");
const path      = require("path");
const fs        = require("fs");
const { v4: uuidv4 } = require("uuid");

// ── Bootstrap backend modules ──────────────────────────────────
const BACKEND = path.join(__dirname, "../backend");
process.chdir(BACKEND);

const config       = require("./src/config");
const User         = require("./src/models/User");
const Hospital     = require("./src/models/Hospital");
const MedicalRecord = require("./src/models/MedicalRecord");
const enc          = require("./src/services/encryptionService");
const storage      = require("./src/services/storageService");
const blockchain   = require("./src/services/blockchainService");
const audit        = require("./src/services/auditService");

const DATASET_FILE = path.join(__dirname, "synthetic/synthea_sample.json");

async function importDataset() {
  console.log("=".repeat(60));
  console.log("Healthcare Blockchain — Dataset Import");
  console.log("=".repeat(60));

  await mongoose.connect(config.mongoUri);
  console.log("✓ Connected to MongoDB");

  const dataset = JSON.parse(fs.readFileSync(DATASET_FILE, "utf8"));
  console.log(`✓ Loaded dataset: ${dataset.encounters.length} encounters, ${dataset.patients.length} patients`);

  let imported = 0;
  let skipped  = 0;
  let errors   = 0;

  for (const encounter of dataset.encounters) {
    try {
      // Find the matching patient
      const patientData = dataset.patients.find(p => p.syntheaId === encounter.patientSyntheaId);
      if (!patientData) { console.warn(`  SKIP: No patient for ${encounter.syntheaEncounterId}`); skipped++; continue; }

      const patient = await User.findOne({ email: patientData.email, role: "patient" });
      if (!patient) { console.warn(`  SKIP: Patient not seeded (${patientData.email}) — run seed first`); skipped++; continue; }
      if (!patient.walletAddress) { console.warn(`  SKIP: Patient has no wallet: ${patient.email}`); skipped++; continue; }

      // Find Hospital A doctor (primary hospital for this patient)
      const hospA = await Hospital.findOne({ code: "HOSPITAL_A" });
      if (!hospA) { console.error("  ERROR: Hospital A not found — run seed first"); errors++; continue; }

      const doctor = await User.findOne({ hospitalId: hospA._id, role: "doctor" });
      if (!doctor) { console.warn(`  SKIP: No doctor in Hospital A`); skipped++; continue; }

      // Check for duplicate
      const existingSyntheaRecord = await MedicalRecord.findOne({ syntheaEncounterId: encounter.syntheaEncounterId });
      if (existingSyntheaRecord) { console.log(`  SKIP: Already imported ${encounter.syntheaEncounterId}`); skipped++; continue; }

      const recordId = uuidv4();
      const now = new Date().toISOString();

      const recordPayload = {
        recordId,
        patientId:      String(patient._id),
        hospitalId:     String(hospA._id),
        doctorId:       String(doctor._id),
        recordType:     encounter.type,
        recordCategory: encounter.category,
        encounterDate:  encounter.encounterDate,
        createdAt:      now,
        content:        encounter.content,
        _synthea: {
          encounterId: encounter.syntheaEncounterId,
          patientId:   encounter.patientSyntheaId,
          note:        "Synthetic data — NOT real clinical evidence",
        },
      };

      // Canonicalize + hash
      const canonicalJson = enc.canonicalizeRecord(recordPayload);
      const contentHash   = enc.computeHash(canonicalJson);

      // Encrypt + store
      const envelope   = enc.encrypt(canonicalJson);
      const storageRef = await storage.save(recordId, envelope);

      // Register on blockchain
      let txHash = null;
      try {
        if (hospA.blockchainAddress) {
          const result = await blockchain.registerRecord({
            recordId,
            contentHash,
            patientAddress:  patient.walletAddress,
            hospitalAddress: hospA.blockchainAddress,
            recordCategory:  encounter.category,
          });
          txHash = result.txHash;
        }
      } catch (err) {
        console.warn(`  WARN: Blockchain registration failed for ${recordId}:`, err.message);
      }

      // Save to DB
      await MedicalRecord.create({
        recordId,
        patientId:          patient._id,
        hospitalId:         hospA._id,
        doctorId:           doctor._id,
        recordType:         encounter.type,
        recordCategory:     encounter.category,
        contentHash,
        storageRef,
        blockchainTxHash:   txHash,
        encounterDate:      new Date(encounter.encounterDate),
        syntheaEncounterId: encounter.syntheaEncounterId,
      });

      await audit.log({
        actorId: doctor._id, actorRole: "doctor", hospitalId: hospA._id,
        action: "RECORD_IMPORTED", recordId,
        blockchainTxHash: txHash, outcome: "success",
        detail: `synthea=${encounter.syntheaEncounterId}`,
      });

      console.log(`  ✓ Imported: ${encounter.syntheaEncounterId} → recordId=${recordId}${txHash ? " tx=" + txHash.slice(0,12) : ""}`);
      imported++;
    } catch (err) {
      console.error(`  ERROR importing ${encounter.syntheaEncounterId}:`, err.message);
      errors++;
    }
  }

  console.log("\n=== Import complete ===");
  console.log(`  Imported: ${imported}`);
  console.log(`  Skipped:  ${skipped}`);
  console.log(`  Errors:   ${errors}`);
  console.log("\nNote: All records are synthetic data for demonstration purposes only.");
  await mongoose.disconnect();
}

importDataset().catch(console.error);
