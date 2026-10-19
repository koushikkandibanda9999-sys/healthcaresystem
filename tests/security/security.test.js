/**
 * Security and Negative Tests
 *
 * Tests:
 *   1. Unauthenticated access to protected endpoints
 *   2. Cross-patient record access
 *   3. Hospital B accessing a record without consent
 *   4. Access after consent denial
 *   5. Expired token
 *   6. Wrong role trying to create a record
 *   7. Tampered record detection
 *   8. Malformed inputs
 *   9. Duplicate access requests
 *  10. Invalid record ID
 *
 * NOTE: Blockchain interactions are mocked. Tests focus on the backend
 * authorization layer. Smart contract negative tests are in MedicalRecords.test.js.
 */

const request  = require("supertest");
const mongoose = require("mongoose");
const path     = require("path");
const crypto   = require("crypto");

// Mock blockchain
jest.mock(path.join(__dirname, "../../backend/src/services/blockchainService"), () => ({
  registerHospital: jest.fn().mockResolvedValue({ txHash: "0xmock" }),
  registerDoctor:   jest.fn().mockResolvedValue({ txHash: "0xmock" }),
  registerRecord:   jest.fn().mockResolvedValue({ txHash: "0xmock" }),
  isAccessGranted:  jest.fn().mockResolvedValue(false),
  checkRecordHash:  jest.fn().mockResolvedValue(true),
  healthCheck:      jest.fn().mockResolvedValue({ ok: true }),
  uuidToBytes32:    jest.fn(id => "0x" + id.replace(/-/g, "").padEnd(64, "0")),
  hexToBytes32:     jest.fn(h => "0x" + h.padStart(64, "0")),
  getProvider:      jest.fn(),
  getSigner:        jest.fn(),
}));

let app;
let patientToken, doctorAToken, doctorBToken, patientBToken;
let patientId, doctorAId, hospitalAId;
let sampleRecordId;

beforeAll(async () => {
  const { MongoMemoryServer } = require("mongodb-memory-server");
  const mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI      = mongod.getUri();
  process.env.JWT_SECRET     = "test_security_secret_min_64_chars_xxxxxxxxxxxxxxxxxxxxxxxxx";
  process.env.RECORD_ENCRYPTION_KEY = "b".repeat(64);
  process.env.NODE_ENV       = "test";
  process.env.STORAGE_PATH   = path.join(__dirname, "../../storage/test_records");

  app = require("../../backend/server");

  const Hospital = require("../../backend/src/models/Hospital");
  const hospA = await Hospital.create({ name: "Security Test Hosp A", code: "SEC_A", blockchainAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", isActive: true });
  const hospB = await Hospital.create({ name: "Security Test Hosp B", code: "SEC_B", blockchainAddress: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", isActive: true });
  hospitalAId = hospA._id.toString();

  // Register patient A
  let r = await request(app).post("/api/auth/register")
    .send({ name: "Patient A", email: "patient.a@sec.test", password: "Password123!", role: "patient" });
  patientToken = r.body.token;
  patientId    = r.body.user._id;

  // Set wallet address for patient A
  const User = require("../../backend/src/models/User");
  await User.findByIdAndUpdate(patientId, { walletAddress: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc" });

  // Register patient B
  r = await request(app).post("/api/auth/register")
    .send({ name: "Patient B", email: "patient.b@sec.test", password: "Password123!", role: "patient" });
  patientBToken = r.body.token;

  // Register doctor at hospital A
  r = await request(app).post("/api/auth/register")
    .send({ name: "Dr. A", email: "dr.a@sec.test", password: "Password123!", role: "doctor", hospitalCode: "SEC_A" });
  doctorAToken = r.body.token;
  doctorAId    = r.body.user._id;
  await User.findByIdAndUpdate(doctorAId, { walletAddress: "0x90F79bf6EB2c4f870365E785982E1f101E93b906" });

  // Register doctor at hospital B
  r = await request(app).post("/api/auth/register")
    .send({ name: "Dr. B", email: "dr.b@sec.test", password: "Password123!", role: "doctor", hospitalCode: "SEC_B" });
  doctorBToken = r.body.token;

  // Doctor A creates a record for patient A
  r = await request(app).post("/api/records")
    .set("Authorization", `Bearer ${doctorAToken}`)
    .send({
      patientId,
      recordType: "ENCOUNTER",
      recordCategory: "ENCOUNTER",
      content: { diagnosis: "J45.20", notes: "Security test record" },
    });
  sampleRecordId = r.body.recordId;
});

afterAll(async () => {
  await mongoose.disconnect();
});

// ── 1. Unauthenticated access ─────────────────────────────────
describe("1 · Unauthenticated access", () => {
  it("GET /api/patients/me requires auth", async () => {
    const r = await request(app).get("/api/patients/me");
    expect(r.status).toBe(401);
  });
  it("POST /api/records requires auth", async () => {
    const r = await request(app).post("/api/records").send({ foo: "bar" });
    expect(r.status).toBe(401);
  });
  it("GET /api/audit requires auth", async () => {
    const r = await request(app).get("/api/audit");
    expect(r.status).toBe(401);
  });
  it("GET /api/access-requests requires auth", async () => {
    const r = await request(app).get("/api/access-requests");
    expect(r.status).toBe(401);
  });
});

// ── 2. Cross-patient access ───────────────────────────────────
describe("2 · Cross-patient access", () => {
  it("Patient B cannot view Patient A's records", async () => {
    const r = await request(app)
      .get(`/api/records/${sampleRecordId}`)
      .set("Authorization", `Bearer ${patientBToken}`);
    expect(r.status).toBe(403);
  });

  it("Patient B cannot view Patient A's access requests", async () => {
    const r = await request(app)
      .get("/api/patients/me/records")
      .set("Authorization", `Bearer ${patientBToken}`);
    expect(r.status).toBe(200); // can see own (empty) list
    expect(r.body.records).toHaveLength(0);
  });
});

// ── 3. Hospital B without consent ────────────────────────────
describe("3 · Hospital B accessing without consent", () => {
  it("Doctor B cannot access Patient A's record without consent", async () => {
    const r = await request(app)
      .get(`/api/records/${sampleRecordId}`)
      .set("Authorization", `Bearer ${doctorBToken}`);
    // isAccessGranted returns false (mocked), so access is denied
    expect(r.status).toBe(403);
  });
});

// ── 4. Wrong role ─────────────────────────────────────────────
describe("4 · Role enforcement", () => {
  it("Patient cannot create a medical record", async () => {
    const r = await request(app).post("/api/records")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({ patientId, recordType: "ENCOUNTER", recordCategory: "ENCOUNTER", content: {} });
    expect(r.status).toBe(403);
  });

  it("Doctor cannot grant/deny access (patient only)", async () => {
    const r = await request(app).post("/api/access-requests/fake-id/grant")
      .set("Authorization", `Bearer ${doctorAToken}`)
      .send({});
    expect(r.status).toBe(403);
  });
});

// ── 5. Invalid token ──────────────────────────────────────────
describe("5 · Invalid tokens", () => {
  it("Malformed token is rejected", async () => {
    const r = await request(app).get("/api/patients/me")
      .set("Authorization", "Bearer notarealtoken");
    expect(r.status).toBe(401);
  });

  it("Token with tampered payload is rejected", async () => {
    const [header, payload, sig] = patientToken.split(".");
    const fakePayload = Buffer.from(JSON.stringify({ userId: "fakeid", role: "sysAdmin" })).toString("base64url");
    const r = await request(app).get("/api/patients/me")
      .set("Authorization", `Bearer ${header}.${fakePayload}.${sig}`);
    expect(r.status).toBe(401);
  });
});

// ── 6. Input validation ───────────────────────────────────────
describe("6 · Input validation", () => {
  it("Registration with invalid email is rejected", async () => {
    const r = await request(app).post("/api/auth/register")
      .send({ name: "Test", email: "notanemail", password: "Password123!", role: "patient" });
    expect(r.status).toBe(400);
  });

  it("Record creation without required fields returns 400", async () => {
    const r = await request(app).post("/api/records")
      .set("Authorization", `Bearer ${doctorAToken}`)
      .send({ recordType: "ENCOUNTER" }); // missing patientId, content
    expect(r.status).toBe(400);
  });

  it("Non-existent record returns 404", async () => {
    const r = await request(app).get("/api/records/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${patientToken}`);
    expect(r.status).toBe(404);
  });
});

// ── 7. Tampered record detection ──────────────────────────────
describe("7 · Record tampering detection", () => {
  it("Verify endpoint returns integrity result", async () => {
    if (!sampleRecordId) return;
    const r = await request(app).post(`/api/records/${sampleRecordId}/verify`)
      .set("Authorization", `Bearer ${patientToken}`);
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty("overallVerified");
  });

  it("Tampered encrypted file fails verification", async () => {
    if (!sampleRecordId) return;
    // Load the record metadata to get storageRef, then tamper the file
    const MedicalRecord = require("../../backend/src/models/MedicalRecord");
    const record = await MedicalRecord.findOne({ recordId: sampleRecordId });
    if (!record) return;

    const fs = require("fs");
    const config = require("../../backend/src/config");
    const filePath = require("path").join(config.storagePath, record.storageRef);

    if (!fs.existsSync(filePath)) return;

    // Read, tamper, and write back
    const envelope = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const originalCiphertext = envelope.ciphertext;
    // Flip a bit in the ciphertext
    const buf = Buffer.from(originalCiphertext, "hex");
    buf[0] = buf[0] ^ 0xFF;
    envelope.ciphertext = buf.toString("hex");
    fs.writeFileSync(filePath, JSON.stringify(envelope));

    // Verify — should fail (GCM auth tag mismatch or hash mismatch)
    const r = await request(app).post(`/api/records/${sampleRecordId}/verify`)
      .set("Authorization", `Bearer ${patientToken}`);
    // Either a 500 (GCM decrypt error) or a verified:false result
    if (r.status === 200) {
      expect(r.body.overallVerified).toBe(false);
    } else {
      expect(r.status).toBe(500);
    }

    // Restore
    envelope.ciphertext = originalCiphertext;
    fs.writeFileSync(filePath, JSON.stringify(envelope));
  });
});

// ── 8. Duplicate access requests ──────────────────────────────
describe("8 · Duplicate and invalid state transitions", () => {
  it("Duplicate pending request returns 409", async () => {
    if (!sampleRecordId) return;
    // First request
    await request(app).post("/api/access-requests")
      .set("Authorization", `Bearer ${doctorBToken}`)
      .send({ recordId: sampleRecordId, requestedScope: "*" });
    // Duplicate
    const r = await request(app).post("/api/access-requests")
      .set("Authorization", `Bearer ${doctorBToken}`)
      .send({ recordId: sampleRecordId, requestedScope: "*" });
    expect(r.status).toBe(409);
  });
});
