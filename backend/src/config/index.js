require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });

module.exports = {
  port:           process.env.PORT || 5000,
  nodeEnv:        process.env.NODE_ENV || "development",
  mongoUri:       process.env.MONGO_URI || "mongodb://localhost:27017/healthcare_blockchain",
  jwtSecret:      process.env.JWT_SECRET || "dev_secret_change_in_production_min_64_chars",
  jwtExpiresIn:   process.env.JWT_EXPIRES_IN || "8h",
  // 32-byte hex key for AES-256-GCM
  recordEncKey:   process.env.RECORD_ENCRYPTION_KEY || "0".repeat(64),
  storagePath:    process.env.STORAGE_PATH || "./storage/records",
  hardhatRpcUrl:  process.env.HARDHAT_RPC_URL || "http://127.0.0.1:8545",
  contractAddress: process.env.CONTRACT_ADDRESS || "",
  backendSignerKey: process.env.BACKEND_SIGNER_PRIVATE_KEY || "",
};
