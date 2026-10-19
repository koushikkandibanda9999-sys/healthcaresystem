/**
 * MedicalRecords.sol — Comprehensive Test Suite
 *
 * Tests cover:
 *   - Hospital and doctor registration (authorized + unauthorized)
 *   - Record registration (authorized + unauthorized + duplicate)
 *   - Access request workflow
 *   - Consent grant (valid + expired + already-granted)
 *   - Consent denial
 *   - Consent revocation
 *   - isAccessGranted (granted / denied / revoked / expired)
 *   - verifyRecordHash / checkRecordHash (match + mismatch)
 *   - logRecordAccess (authorized + unauthorized)
 *   - Enumeration helpers
 *   - Invalid inputs and state transitions
 */

const { expect }  = require("chai");
const { ethers }  = require("hardhat");
const { time }    = require("@nomicfoundation/hardhat-network-helpers");
const crypto      = require("crypto");

// anyValue matcher for Hardhat chai-matchers
const ANY_UINT = (val) => typeof val === "bigint" || typeof val === "number";

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

/** Convert a UUID string to bytes32 (hex-pad the first 32 chars of the UTF-8 hex). */
function uuidToBytes32(uuid) {
  const clean = uuid.replace(/-/g, "");
  return "0x" + clean.padEnd(64, "0");
}

/** SHA-256 a string, return bytes32 hex */
function sha256Bytes32(str) {
  return "0x" + crypto.createHash("sha256").update(str).digest("hex");
}

const RECORD_ID_1 = uuidToBytes32("aaaabbbb-cccc-dddd-eeee-ffffffffffff");
const RECORD_ID_2 = uuidToBytes32("11112222-3333-4444-5555-666677778888");
const ZERO_BYTES32 = "0x" + "00".repeat(32);

const CANONICAL_JSON_1 = JSON.stringify(
  { patientId: "P001", type: "ENCOUNTER", diagnosis: "J45", ts: "2024-01-15T10:00:00Z" },
  Object.keys({ patientId: "", type: "", diagnosis: "", ts: "" }).sort()
);

const CONTENT_HASH_1 = sha256Bytes32(CANONICAL_JSON_1);

// ──────────────────────────────────────────────────────────────
// Test suite
// ──────────────────────────────────────────────────────────────

describe("MedicalRecords", function () {
  let contract;
  let owner, hospitalA, hospitalB, doctorA, doctorB, patient, stranger, patient2;

  beforeEach(async function () {
    [owner, hospitalA, hospitalB, doctorA, doctorB, patient, stranger, patient2] =
      await ethers.getSigners();

    const Factory = await ethers.getContractFactory("MedicalRecords");
    contract = await Factory.deploy();
    await contract.waitForDeployment();
  });

  // ============================================================
  //  1. Ownership
  // ============================================================
  describe("1 · Ownership", function () {
    it("sets deployer as owner", async function () {
      expect(await contract.owner()).to.equal(owner.address);
    });
  });

  // ============================================================
  //  2. Hospital Registration
  // ============================================================
  describe("2 · Hospital Registration", function () {
    it("owner can register a hospital", async function () {
      const tx = await contract.connect(owner).registerHospital(hospitalA.address, "Hospital A");
      await expect(tx).to.emit(contract, "HospitalRegistered");

      const h = await contract.hospitals(hospitalA.address);
      expect(h.active).to.equal(true);
      expect(h.name).to.equal("Hospital A");
    });

    it("non-owner cannot register a hospital", async function () {
      await expect(
        contract.connect(stranger).registerHospital(hospitalA.address, "Hospital A")
      ).to.be.revertedWith("MR: not owner");
    });

    it("cannot register zero address", async function () {
      await expect(
        contract.connect(owner).registerHospital(ethers.ZeroAddress, "X")
      ).to.be.revertedWith("MR: zero address");
    });

    it("cannot register with empty name", async function () {
      await expect(
        contract.connect(owner).registerHospital(hospitalA.address, "")
      ).to.be.revertedWith("MR: empty name");
    });

    it("cannot register the same hospital twice", async function () {
      await contract.connect(owner).registerHospital(hospitalA.address, "Hospital A");
      await expect(
        contract.connect(owner).registerHospital(hospitalA.address, "Hospital A Duplicate")
      ).to.be.revertedWith("MR: already registered");
    });

    it("owner can deactivate a hospital", async function () {
      await contract.connect(owner).registerHospital(hospitalA.address, "Hospital A");
      await expect(contract.connect(owner).deactivateHospital(hospitalA.address))
        .to.emit(contract, "HospitalDeactivated");
      const h = await contract.hospitals(hospitalA.address);
      expect(h.active).to.equal(false);
    });

    it("hospitalList reflects registrations", async function () {
      await contract.connect(owner).registerHospital(hospitalA.address, "Hospital A");
      await contract.connect(owner).registerHospital(hospitalB.address, "Hospital B");
      const list = await contract.getHospitalList();
      expect(list).to.include(hospitalA.address);
      expect(list).to.include(hospitalB.address);
    });
  });

  // ============================================================
  //  3. Doctor Registration
  // ============================================================
  describe("3 · Doctor Registration", function () {
    beforeEach(async function () {
      await contract.connect(owner).registerHospital(hospitalA.address, "Hospital A");
    });

    it("owner can register a doctor", async function () {
      await expect(
        contract.connect(owner).registerDoctor(doctorA.address, hospitalA.address)
      ).to.emit(contract, "DoctorRegistered");

      const d = await contract.doctors(doctorA.address);
      expect(d.active).to.equal(true);
      expect(d.hospitalAddr).to.equal(hospitalA.address);
    });

    it("hospital address itself can register its own doctors", async function () {
      await expect(
        contract.connect(hospitalA).registerDoctor(doctorA.address, hospitalA.address)
      ).to.emit(contract, "DoctorRegistered");
    });

    it("stranger cannot register a doctor", async function () {
      await expect(
        contract.connect(stranger).registerDoctor(doctorA.address, hospitalA.address)
      ).to.be.revertedWith("MR: not authorized to register doctor");
    });

    it("cannot register doctor under inactive hospital", async function () {
      await contract.connect(owner).deactivateHospital(hospitalA.address);
      await expect(
        contract.connect(owner).registerDoctor(doctorA.address, hospitalA.address)
      ).to.be.revertedWith("MR: hospital not active");
    });

    it("cannot register duplicate doctor", async function () {
      await contract.connect(owner).registerDoctor(doctorA.address, hospitalA.address);
      await expect(
        contract.connect(owner).registerDoctor(doctorA.address, hospitalA.address)
      ).to.be.revertedWith("MR: already registered");
    });
  });

  // ============================================================
  //  4. Record Registration
  // ============================================================
  describe("4 · Record Registration", function () {
    beforeEach(async function () {
      await contract.connect(owner).registerHospital(hospitalA.address, "Hospital A");
      await contract.connect(owner).registerDoctor(doctorA.address, hospitalA.address);
    });

    it("authorized doctor can register a record", async function () {
      const tx = await contract.connect(doctorA).registerRecord(
        RECORD_ID_1, CONTENT_HASH_1, patient.address, hospitalA.address, "ENCOUNTER"
      );
      await expect(tx).to.emit(contract, "RecordRegistered");

      const r = await contract.records(RECORD_ID_1);
      expect(r.active).to.equal(true);
      expect(r.contentHash).to.equal(CONTENT_HASH_1);
      expect(r.patientAddr).to.equal(patient.address);
    });

    it("unregistered actor cannot register a record", async function () {
      await expect(
        contract.connect(stranger).registerRecord(
          RECORD_ID_1, CONTENT_HASH_1, patient.address, hospitalA.address, "ENCOUNTER"
        )
      ).to.be.revertedWith("MR: caller not active doctor");
    });

    it("doctor cannot register for a different hospital", async function () {
      await contract.connect(owner).registerHospital(hospitalB.address, "Hospital B");
      await expect(
        contract.connect(doctorA).registerRecord(
          RECORD_ID_1, CONTENT_HASH_1, patient.address, hospitalB.address, "ENCOUNTER"
        )
      ).to.be.revertedWith("MR: hospital mismatch");
    });

    it("cannot register with zero content hash", async function () {
      await expect(
        contract.connect(doctorA).registerRecord(
          RECORD_ID_1, ZERO_BYTES32, patient.address, hospitalA.address, "ENCOUNTER"
        )
      ).to.be.revertedWith("MR: empty hash");
    });

    it("cannot register duplicate recordId", async function () {
      await contract.connect(doctorA).registerRecord(
        RECORD_ID_1, CONTENT_HASH_1, patient.address, hospitalA.address, "ENCOUNTER"
      );
      await expect(
        contract.connect(doctorA).registerRecord(
          RECORD_ID_1, CONTENT_HASH_1, patient.address, hospitalA.address, "ENCOUNTER"
        )
      ).to.be.revertedWith("MR: duplicate recordId");
    });

    it("patientRecords enumeration is updated", async function () {
      await contract.connect(doctorA).registerRecord(
        RECORD_ID_1, CONTENT_HASH_1, patient.address, hospitalA.address, "ENCOUNTER"
      );
      const ids = await contract.getPatientRecordIds(patient.address);
      expect(ids).to.include(RECORD_ID_1);
    });
  });

  // ============================================================
  //  5. Access Requests
  // ============================================================
  describe("5 · Access Requests", function () {
    beforeEach(async function () {
      await contract.connect(owner).registerHospital(hospitalA.address, "Hospital A");
      await contract.connect(owner).registerHospital(hospitalB.address, "Hospital B");
      await contract.connect(owner).registerDoctor(doctorA.address, hospitalA.address);
      await contract.connect(doctorA).registerRecord(
        RECORD_ID_1, CONTENT_HASH_1, patient.address, hospitalA.address, "ENCOUNTER"
      );
    });

    it("active hospital can request access", async function () {
      await expect(
        contract.connect(hospitalB).requestAccess(RECORD_ID_1, "ENCOUNTER")
      ).to.emit(contract, "AccessRequested");

      const g = await contract.accessGrants(RECORD_ID_1, hospitalB.address);
      expect(g.status).to.equal(1); // Pending
    });

    it("unregistered address cannot request access", async function () {
      await expect(
        contract.connect(stranger).requestAccess(RECORD_ID_1, "ENCOUNTER")
      ).to.be.revertedWith("MR: caller not active hospital");
    });

    it("owning hospital cannot request its own record", async function () {
      await expect(
        contract.connect(hospitalA).requestAccess(RECORD_ID_1, "ENCOUNTER")
      ).to.be.revertedWith("MR: cannot request own hospital's record");
    });

    it("cannot request non-existent record", async function () {
      await expect(
        contract.connect(hospitalB).requestAccess(RECORD_ID_2, "ENCOUNTER")
      ).to.be.revertedWith("MR: record not found or inactive");
    });

    it("requestors list is populated", async function () {
      await contract.connect(hospitalB).requestAccess(RECORD_ID_1, "ENCOUNTER");
      const requestors = await contract.getRecordRequestors(RECORD_ID_1);
      expect(requestors).to.include(hospitalB.address);
    });
  });

  // ============================================================
  //  6. Consent Grant
  // ============================================================
  describe("6 · Consent Grant", function () {
    beforeEach(async function () {
      await contract.connect(owner).registerHospital(hospitalA.address, "Hospital A");
      await contract.connect(owner).registerHospital(hospitalB.address, "Hospital B");
      await contract.connect(owner).registerDoctor(doctorA.address, hospitalA.address);
      await contract.connect(doctorA).registerRecord(
        RECORD_ID_1, CONTENT_HASH_1, patient.address, hospitalA.address, "ENCOUNTER"
      );
      await contract.connect(hospitalB).requestAccess(RECORD_ID_1, "ENCOUNTER");
    });

    it("patient can grant access (no expiry)", async function () {
      await expect(
        contract.connect(patient).grantAccess(RECORD_ID_1, hospitalB.address, 0)
      ).to.emit(contract, "AccessGranted");

      expect(await contract.isAccessGranted(RECORD_ID_1, hospitalB.address)).to.equal(true);
    });

    it("patient can grant access with future expiry", async function () {
      const future = (await time.latest()) + 3600; // +1 hour
      await contract.connect(patient).grantAccess(RECORD_ID_1, hospitalB.address, future);
      expect(await contract.isAccessGranted(RECORD_ID_1, hospitalB.address)).to.equal(true);
    });

    it("access is denied after expiry timestamp", async function () {
      const future = (await time.latest()) + 10;
      await contract.connect(patient).grantAccess(RECORD_ID_1, hospitalB.address, future);
      // Fast-forward time beyond expiry
      await time.increase(20);
      expect(await contract.isAccessGranted(RECORD_ID_1, hospitalB.address)).to.equal(false);
    });

    it("non-patient cannot grant access", async function () {
      await expect(
        contract.connect(stranger).grantAccess(RECORD_ID_1, hospitalB.address, 0)
      ).to.be.revertedWith("MR: only patient can grant access");
    });

    it("cannot grant with expiry in the past", async function () {
      const past = (await time.latest()) - 100;
      await expect(
        contract.connect(patient).grantAccess(RECORD_ID_1, hospitalB.address, past)
      ).to.be.revertedWith("MR: expiry in the past");
    });

    it("cannot double-grant", async function () {
      await contract.connect(patient).grantAccess(RECORD_ID_1, hospitalB.address, 0);
      await expect(
        contract.connect(patient).grantAccess(RECORD_ID_1, hospitalB.address, 0)
      ).to.be.revertedWith("MR: already granted");
    });
  });

  // ============================================================
  //  7. Consent Denial
  // ============================================================
  describe("7 · Consent Denial", function () {
    beforeEach(async function () {
      await contract.connect(owner).registerHospital(hospitalA.address, "Hospital A");
      await contract.connect(owner).registerHospital(hospitalB.address, "Hospital B");
      await contract.connect(owner).registerDoctor(doctorA.address, hospitalA.address);
      await contract.connect(doctorA).registerRecord(
        RECORD_ID_1, CONTENT_HASH_1, patient.address, hospitalA.address, "ENCOUNTER"
      );
      await contract.connect(hospitalB).requestAccess(RECORD_ID_1, "ENCOUNTER");
    });

    it("patient can deny access", async function () {
      await expect(
        contract.connect(patient).denyAccess(RECORD_ID_1, hospitalB.address)
      ).to.emit(contract, "AccessDenied");

      expect(await contract.isAccessGranted(RECORD_ID_1, hospitalB.address)).to.equal(false);
      const g = await contract.accessGrants(RECORD_ID_1, hospitalB.address);
      expect(g.status).to.equal(3); // Denied
    });

    it("non-patient cannot deny access", async function () {
      await expect(
        contract.connect(stranger).denyAccess(RECORD_ID_1, hospitalB.address)
      ).to.be.revertedWith("MR: only patient can deny");
    });

    it("cannot deny a non-pending request", async function () {
      await contract.connect(patient).grantAccess(RECORD_ID_1, hospitalB.address, 0);
      await expect(
        contract.connect(patient).denyAccess(RECORD_ID_1, hospitalB.address)
      ).to.be.revertedWith("MR: not pending");
    });
  });

  // ============================================================
  //  8. Consent Revocation
  // ============================================================
  describe("8 · Consent Revocation", function () {
    beforeEach(async function () {
      await contract.connect(owner).registerHospital(hospitalA.address, "Hospital A");
      await contract.connect(owner).registerHospital(hospitalB.address, "Hospital B");
      await contract.connect(owner).registerDoctor(doctorA.address, hospitalA.address);
      await contract.connect(doctorA).registerRecord(
        RECORD_ID_1, CONTENT_HASH_1, patient.address, hospitalA.address, "ENCOUNTER"
      );
      await contract.connect(hospitalB).requestAccess(RECORD_ID_1, "ENCOUNTER");
      await contract.connect(patient).grantAccess(RECORD_ID_1, hospitalB.address, 0);
    });

    it("patient can revoke a granted access", async function () {
      expect(await contract.isAccessGranted(RECORD_ID_1, hospitalB.address)).to.equal(true);

      await expect(
        contract.connect(patient).revokeAccess(RECORD_ID_1, hospitalB.address)
      ).to.emit(contract, "AccessRevoked");

      expect(await contract.isAccessGranted(RECORD_ID_1, hospitalB.address)).to.equal(false);
    });

    it("non-patient cannot revoke", async function () {
      await expect(
        contract.connect(stranger).revokeAccess(RECORD_ID_1, hospitalB.address)
      ).to.be.revertedWith("MR: only patient can revoke");
    });

    it("cannot revoke a non-granted access (e.g. pending)", async function () {
      // Register second record with a pending request
      const hash2 = sha256Bytes32("another record");
      await contract.connect(doctorA).registerRecord(
        RECORD_ID_2, hash2, patient.address, hospitalA.address, "LAB"
      );
      await contract.connect(hospitalB).requestAccess(RECORD_ID_2, "LAB");
      await expect(
        contract.connect(patient).revokeAccess(RECORD_ID_2, hospitalB.address)
      ).to.be.revertedWith("MR: not currently granted");
    });
  });

  // ============================================================
  //  9. Hash Verification
  // ============================================================
  describe("9 · Hash Verification", function () {
    beforeEach(async function () {
      await contract.connect(owner).registerHospital(hospitalA.address, "Hospital A");
      await contract.connect(owner).registerDoctor(doctorA.address, hospitalA.address);
      await contract.connect(doctorA).registerRecord(
        RECORD_ID_1, CONTENT_HASH_1, patient.address, hospitalA.address, "ENCOUNTER"
      );
    });

    it("verifyRecordHash returns true for matching hash", async function () {
      const tx = await contract.verifyRecordHash(RECORD_ID_1, CONTENT_HASH_1);
      await expect(tx).to.emit(contract, "RecordHashVerified");
      // Also verify via view function
      expect(await contract.checkRecordHash(RECORD_ID_1, CONTENT_HASH_1)).to.equal(true);
    });

    it("verifyRecordHash returns false for tampered hash", async function () {
      const tamperedHash = sha256Bytes32("tampered content");
      const tx = await contract.verifyRecordHash(RECORD_ID_1, tamperedHash);
      await expect(tx).to.emit(contract, "RecordHashVerified");
    });

    it("checkRecordHash view returns true for correct hash", async function () {
      expect(await contract.checkRecordHash(RECORD_ID_1, CONTENT_HASH_1)).to.equal(true);
    });

    it("checkRecordHash view returns false for wrong hash", async function () {
      const wrong = sha256Bytes32("wrong");
      expect(await contract.checkRecordHash(RECORD_ID_1, wrong)).to.equal(false);
    });

    it("verifyRecordHash reverts for non-existent record", async function () {
      await expect(
        contract.verifyRecordHash(RECORD_ID_2, CONTENT_HASH_1)
      ).to.be.revertedWith("MR: record not found or inactive");
    });
  });

  // ============================================================
  //  10. logRecordAccess
  // ============================================================
  describe("10 · logRecordAccess", function () {
    beforeEach(async function () {
      await contract.connect(owner).registerHospital(hospitalA.address, "Hospital A");
      await contract.connect(owner).registerHospital(hospitalB.address, "Hospital B");
      await contract.connect(owner).registerDoctor(doctorA.address, hospitalA.address);
      await contract.connect(doctorA).registerRecord(
        RECORD_ID_1, CONTENT_HASH_1, patient.address, hospitalA.address, "ENCOUNTER"
      );
    });

    it("active hospital can log access", async function () {
      const tx = await contract.connect(hospitalB).logRecordAccess(RECORD_ID_1);
      await expect(tx).to.emit(contract, "RecordAccessed");
    });

    it("active doctor can log access", async function () {
      await expect(contract.connect(doctorA).logRecordAccess(RECORD_ID_1))
        .to.emit(contract, "RecordAccessed");
    });

    it("stranger cannot log access", async function () {
      await expect(
        contract.connect(stranger).logRecordAccess(RECORD_ID_1)
      ).to.be.revertedWith("MR: unauthorized logger");
    });
  });

  // ============================================================
  //  11. Cross-patient isolation
  // ============================================================
  describe("11 · Cross-patient isolation", function () {
    it("patient2 cannot grant access to patient1's record", async function () {
      await contract.connect(owner).registerHospital(hospitalA.address, "Hospital A");
      await contract.connect(owner).registerHospital(hospitalB.address, "Hospital B");
      await contract.connect(owner).registerDoctor(doctorA.address, hospitalA.address);
      await contract.connect(doctorA).registerRecord(
        RECORD_ID_1, CONTENT_HASH_1, patient.address, hospitalA.address, "ENCOUNTER"
      );
      await contract.connect(hospitalB).requestAccess(RECORD_ID_1, "ENCOUNTER");

      await expect(
        contract.connect(patient2).grantAccess(RECORD_ID_1, hospitalB.address, 0)
      ).to.be.revertedWith("MR: only patient can grant access");
    });
  });

  // ============================================================
  //  12. Full end-to-end flow
  // ============================================================
  describe("12 · Full end-to-end flow", function () {
    it("completes the inter-hospital consent workflow", async function () {
      // Register participants
      await contract.connect(owner).registerHospital(hospitalA.address, "Hospital A");
      await contract.connect(owner).registerHospital(hospitalB.address, "Hospital B");
      await contract.connect(owner).registerDoctor(doctorA.address, hospitalA.address);

      // Hospital A doctor creates a record for patient
      await contract.connect(doctorA).registerRecord(
        RECORD_ID_1, CONTENT_HASH_1, patient.address, hospitalA.address, "ENCOUNTER"
      );

      // Hospital B requests access
      await contract.connect(hospitalB).requestAccess(RECORD_ID_1, "ENCOUNTER");
      expect(
        (await contract.accessGrants(RECORD_ID_1, hospitalB.address)).status
      ).to.equal(1); // Pending

      // Patient grants access (1-hour window)
      const expiry = (await time.latest()) + 3600;
      await contract.connect(patient).grantAccess(RECORD_ID_1, hospitalB.address, expiry);
      expect(await contract.isAccessGranted(RECORD_ID_1, hospitalB.address)).to.equal(true);

      // Hospital B logs the access
      await contract.connect(hospitalB).logRecordAccess(RECORD_ID_1);

      // Hash is verified (correct)
      expect(await contract.checkRecordHash(RECORD_ID_1, CONTENT_HASH_1)).to.equal(true);

      // Patient revokes access
      await contract.connect(patient).revokeAccess(RECORD_ID_1, hospitalB.address);
      expect(await contract.isAccessGranted(RECORD_ID_1, hospitalB.address)).to.equal(false);

      // Tampered hash fails
      const tampered = sha256Bytes32("TAMPERED");
      expect(await contract.checkRecordHash(RECORD_ID_1, tampered)).to.equal(false);
    });
  });
});
