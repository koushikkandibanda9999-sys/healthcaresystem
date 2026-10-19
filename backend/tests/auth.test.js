/**
 * Backend API Tests — Authentication
 * Uses Jest + Supertest with an in-memory MongoDB (mongodb-memory-server).
 * These tests mock blockchain calls so they run without a live Hardhat node.
 */

const request  = require("supertest");
const mongoose = require("mongoose");

// Mock blockchain service so tests don't require a live chain
jest.mock("../src/services/blockchainService", () => ({
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
let testHospitalId;

beforeAll(async () => {
  // Use a distinct in-memory database for tests
  const { MongoMemoryServer } = require("mongodb-memory-server");
  const mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  process.env.JWT_SECRET = "test_secret_min_64_chars_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
  process.env.RECORD_ENCRYPTION_KEY = "a".repeat(64);
  process.env.NODE_ENV = "test";

  app = require("../server");

  // Create a test hospital
  const Hospital = require("../src/models/Hospital");
  const hosp = await Hospital.create({ name: "Test Hospital", code: "HOSP_TEST", isActive: true });
  testHospitalId = hosp._id;
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe("POST /api/auth/register", () => {
  it("registers a patient successfully", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Alice Patient", email: "alice@test.com", password: "Password123", role: "patient" });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("token");
    expect(res.body.user.role).toBe("patient");
    expect(res.body.user.passwordHash).toBeUndefined(); // never expose hash
  });

  it("rejects duplicate email", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Alice Again", email: "alice@test.com", password: "Password123", role: "patient" });
    expect(res.status).toBe(409);
  });

  it("rejects short password", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Bob", email: "bob@test.com", password: "short", role: "patient" });
    expect(res.status).toBe(400);
  });

  it("rejects invalid role", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "C", email: "c@test.com", password: "Password123", role: "hacker" });
    expect(res.status).toBe(400);
  });

  it("registers a doctor with valid hospitalCode", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Dr Smith", email: "drsmith@test.com", password: "Password123", role: "doctor", hospitalCode: "HOSP_TEST" });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("doctor");
  });

  it("rejects doctor without hospitalCode", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Dr No Hospital", email: "drno@test.com", password: "Password123", role: "doctor" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  beforeAll(async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ name: "Login User", email: "login@test.com", password: "Password123", role: "patient" });
  });

  it("logs in with correct credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "login@test.com", password: "Password123" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
  });

  it("rejects wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "login@test.com", password: "WrongPass123" });
    expect(res.status).toBe(401);
  });

  it("rejects unknown email", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@test.com", password: "Password123" });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/auth/me", () => {
  let token;

  beforeAll(async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ name: "Me User", email: "me@test.com", password: "Password123", role: "patient" });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "me@test.com", password: "Password123" });
    token = res.body.token;
  });

  it("returns current user", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("me@test.com");
  });

  it("rejects unauthenticated request", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("rejects invalid token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer invalidtoken");
    expect(res.status).toBe(401);
  });
});
