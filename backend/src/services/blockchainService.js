/**
 * Blockchain adapter — ethers.js v6 + Hardhat local node
 *
 * This module is the ONLY place in the backend that talks to the EVM chain.
 * All other services call through this interface so that swapping to a
 * Hyperledger Fabric adapter requires changing only this file.
 *
 * Architecture note:
 *   The backend signer is account[0] of the local Hardhat mnemonic (owner/deployer).
 *   It registers hospitals and doctors on-chain on behalf of the system.
 *   Patients and hospitals are identified by their wallet addresses.
 *
 * NEVER log private keys, plaintext records, or patient data here.
 */

const { ethers } = require("ethers");
const config     = require("../config");

// ABI — include only the functions this service calls
const ABI = [
  "function owner() view returns (address)",
  "function registerHospital(address hospitalAddr, string calldata name) external",
  "function deactivateHospital(address hospitalAddr) external",
  "function registerDoctor(address doctorAddr, address hospitalAddr) external",
  "function deactivateDoctor(address doctorAddr) external",
  "function registerRecord(bytes32 recordId, bytes32 contentHash, address patientAddr, address hospitalAddr, string calldata recordCategory) external",
  "function requestAccess(bytes32 recordId, string calldata scope) external",
  "function grantAccess(bytes32 recordId, address requestingHospital, uint256 expiryTimestamp) external",
  "function denyAccess(bytes32 recordId, address requestingHospital) external",
  "function revokeAccess(bytes32 recordId, address requestingHospital) external",
  "function isAccessGranted(bytes32 recordId, address requestingHospital) view returns (bool)",
  "function getAccessStatus(bytes32 recordId, address requestingHospital) view returns (uint8)",
  "function verifyRecordHash(bytes32 recordId, bytes32 submittedHash) external returns (bool)",
  "function checkRecordHash(bytes32 recordId, bytes32 submittedHash) view returns (bool)",
  "function logRecordAccess(bytes32 recordId) external",
  "function records(bytes32) view returns (bytes32 recordId, bytes32 contentHash, address patientAddr, address hospitalAddr, string recordCategory, uint256 createdAt, bool active)",
  "function hospitals(address) view returns (address addr, string name, bool active)",
  "function doctors(address) view returns (address addr, address hospitalAddr, bool active)",
  "function getPatientRecordIds(address patientAddr) view returns (bytes32[])",
  "function getRecordRequestors(bytes32 recordId) view returns (address[])",
  "function accessGrants(bytes32, address) view returns (address requestingHospital, string scope, uint256 expiryTimestamp, uint8 status, uint256 grantedAt, uint256 revokedAt)",
  "event HospitalRegistered(address indexed, string, uint256)",
  "event RecordRegistered(bytes32 indexed, bytes32, address indexed, address indexed, string, uint256)",
  "event AccessRequested(bytes32 indexed, address indexed, string, uint256)",
  "event AccessGranted(bytes32 indexed, address indexed, uint256, uint256)",
  "event AccessDenied(bytes32 indexed, address indexed, uint256)",
  "event AccessRevoked(bytes32 indexed, address indexed, uint256)",
  "event RecordAccessed(bytes32 indexed, address indexed, uint256)",
  "event RecordHashVerified(bytes32 indexed, bool, uint256)",
];

let _provider = null;
let _signer   = null;
let _contract  = null;

function getProvider() {
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider(config.hardhatRpcUrl);
  }
  return _provider;
}

function getSigner() {
  if (!_signer) {
    if (!config.backendSignerKey) {
      throw new Error("BACKEND_SIGNER_PRIVATE_KEY not configured");
    }
    _signer = new ethers.Wallet(config.backendSignerKey, getProvider());
  }
  return _signer;
}

function getContract() {
  if (!_contract) {
    if (!config.contractAddress) {
      throw new Error("CONTRACT_ADDRESS not configured");
    }
    _contract = new ethers.Contract(config.contractAddress, ABI, getSigner());
  }
  return _contract;
}

// ──────────────────────────────────────────────────────────────
// Encoding helpers
// ──────────────────────────────────────────────────────────────

/** UUID string → bytes32 (hex-pad) */
function uuidToBytes32(uuid) {
  const clean = uuid.replace(/-/g, "");
  return "0x" + clean.padEnd(64, "0");
}

/** hex string (64 chars) → bytes32 */
function hexToBytes32(hex) {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return "0x" + clean.padStart(64, "0");
}

// ──────────────────────────────────────────────────────────────
// Hospital management
// ──────────────────────────────────────────────────────────────

async function registerHospital(hospitalAddress, name) {
  const contract = getContract();
  const tx = await contract.registerHospital(hospitalAddress, name);
  const receipt = await tx.wait();
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
}

async function registerDoctor(doctorAddress, hospitalAddress) {
  const contract = getContract();
  const tx = await contract.registerDoctor(doctorAddress, hospitalAddress);
  const receipt = await tx.wait();
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
}

// ──────────────────────────────────────────────────────────────
// Record management
// ──────────────────────────────────────────────────────────────

/**
 * Register a record on-chain.
 * The doctor signer must be the active doctor at the hospital.
 * For the backend-signer approach, the backend signs as the doctor's
 * delegated account; in a full dApp the doctor's MetaMask would sign.
 *
 * @param {object} opts
 * @param {string} opts.recordId        — UUID string
 * @param {string} opts.contentHash     — 64-char hex SHA-256
 * @param {string} opts.patientAddress  — patient wallet address
 * @param {string} opts.hospitalAddress — hospital wallet address
 * @param {string} opts.recordCategory  — category string
 * @param {ethers.Signer} [opts.signer] — override signer (for doctor accounts)
 */
async function registerRecord({ recordId, contentHash, patientAddress, hospitalAddress, recordCategory, signer }) {
  const contract = signer
    ? new ethers.Contract(config.contractAddress, ABI, signer)
    : getContract();

  const rid  = uuidToBytes32(recordId);
  const hash = hexToBytes32(contentHash);

  const tx      = await contract.registerRecord(rid, hash, patientAddress, hospitalAddress, recordCategory);
  const receipt = await tx.wait();
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
}

// ──────────────────────────────────────────────────────────────
// Access control
// ──────────────────────────────────────────────────────────────

async function requestAccess({ recordId, scope, hospitalSigner }) {
  const contract = new ethers.Contract(config.contractAddress, ABI, hospitalSigner);
  const rid = uuidToBytes32(recordId);
  const tx  = await contract.requestAccess(rid, scope || "*");
  const receipt = await tx.wait();
  return { txHash: receipt.hash };
}

async function grantAccess({ recordId, requestingHospitalAddress, expiryTimestamp, patientSigner }) {
  const contract = new ethers.Contract(config.contractAddress, ABI, patientSigner);
  const rid = uuidToBytes32(recordId);
  const exp = expiryTimestamp ? BigInt(expiryTimestamp) : 0n;
  const tx  = await contract.grantAccess(rid, requestingHospitalAddress, exp);
  const receipt = await tx.wait();
  return { txHash: receipt.hash };
}

async function denyAccess({ recordId, requestingHospitalAddress, patientSigner }) {
  const contract = new ethers.Contract(config.contractAddress, ABI, patientSigner);
  const rid = uuidToBytes32(recordId);
  const tx  = await contract.denyAccess(rid, requestingHospitalAddress);
  const receipt = await tx.wait();
  return { txHash: receipt.hash };
}

async function revokeAccess({ recordId, requestingHospitalAddress, patientSigner }) {
  const contract = new ethers.Contract(config.contractAddress, ABI, patientSigner);
  const rid = uuidToBytes32(recordId);
  const tx  = await contract.revokeAccess(rid, requestingHospitalAddress);
  const receipt = await tx.wait();
  return { txHash: receipt.hash };
}

async function isAccessGranted(recordId, requestingHospitalAddress) {
  const contract = getContract();
  const rid = uuidToBytes32(recordId);
  return contract.isAccessGranted(rid, requestingHospitalAddress);
}

async function getAccessStatus(recordId, requestingHospitalAddress) {
  const contract = getContract();
  const rid = uuidToBytes32(recordId);
  return contract.getAccessStatus(rid, requestingHospitalAddress);
}

async function checkRecordHash(recordId, contentHash) {
  const contract = getContract();
  const rid  = uuidToBytes32(recordId);
  const hash = hexToBytes32(contentHash);
  return contract.checkRecordHash(rid, hash);
}

async function logRecordAccess(recordId, accessorSigner) {
  const contract = new ethers.Contract(config.contractAddress, ABI, accessorSigner);
  const rid = uuidToBytes32(recordId);
  try {
    const tx = await contract.logRecordAccess(rid);
    const receipt = await tx.wait();
    return { txHash: receipt.hash };
  } catch (err) {
    // Non-critical — log warning but don't fail the request
    console.warn("[BlockchainService] logRecordAccess failed (non-critical):", err.message);
    return { txHash: null };
  }
}

/**
 * Create a Wallet from a private key (used for per-role signing in tests/seed).
 */
function walletFromPrivateKey(privateKey) {
  return new ethers.Wallet(privateKey, getProvider());
}

/**
 * Check if the blockchain service is configured and reachable.
 */
async function healthCheck() {
  try {
    const provider = getProvider();
    const network  = await provider.getNetwork();
    return { ok: true, chainId: network.chainId.toString(), contractAddress: config.contractAddress };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = {
  uuidToBytes32,
  hexToBytes32,
  registerHospital,
  registerDoctor,
  registerRecord,
  requestAccess,
  grantAccess,
  denyAccess,
  revokeAccess,
  isAccessGranted,
  getAccessStatus,
  checkRecordHash,
  logRecordAccess,
  walletFromPrivateKey,
  healthCheck,
  getProvider,
  getSigner,
};
