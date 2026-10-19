# Healthcare Blockchain — Patient-Centric Medical Record Exchange

> **Design and Performance Evaluation of a Patient-Centric Permissioned Blockchain Framework for Consent-Controlled and Verifiable Inter-Hospital Medical Record Exchange**

A complete, runnable research prototype demonstrating patient-controlled, consent-enforced, blockchain-anchored inter-hospital medical record sharing.

---

## ⚠️ Important Disclaimers

1. **Research prototype only.** This is a local EVM-compatible chain (Hardhat) using Solidity smart contracts for permissioned-style access control. It is **not** a production Hyperledger Fabric network.
2. **Synthetic data only.** All patient data is synthetic. Do not use with real patient information.
3. **Development key management.** AES-256-GCM keys are loaded from `.env`. A production system requires a KMS/HSM.
4. **Patient signing.** In this prototype, consent transactions are signed by backend-held keys. Production requires MetaMask/WalletConnect.

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Bootstrap 5, Recharts, ethers.js |
| Backend | Node.js, Express.js, JWT, bcrypt, express-validator |
| Database | MongoDB with Mongoose ODM |
| Blockchain | Solidity 0.8.24, Hardhat 2.x, ethers.js 6 |
| Encryption | AES-256-GCM (Node.js crypto), SHA-256 integrity hashes |
| Testing | Mocha/Chai (contracts), Jest + Supertest (API) |

---

## Project Structure

```
healthcare-blockchain/
├── frontend/               React + Vite SPA
├── backend/                Express.js REST API
├── contracts/              MedicalRecords.sol
├── blockchain-scripts/     Hardhat deployment
├── tests/
│   ├── contracts/          46 Mocha/Chai contract tests
│   ├── api/                Jest + Supertest API tests
│   └── security/           Security negative tests
├── dataset/                Synthea synthetic data + import script
├── performance/            Benchmark scripts + CSV results
├── docs/                   Architecture, security, methodology
├── hardhat.config.js
├── .env.example
└── README.md
```

---

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB Community Edition (running locally)
- Git

### 1. Clone and install root dependencies
```bash
cd healthcare-blockchain
npm install
```

### 2. Install backend dependencies
```bash
cd backend
npm install
cd ..
```

### 3. Install frontend dependencies
```bash
cd frontend
npm install
cd ..
```

### 4. Configure environment
```bash
cp .env.example .env
```

Edit `.env`:
```
MONGO_URI=mongodb://localhost:27017/healthcare_blockchain
JWT_SECRET=<generate: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
RECORD_ENCRYPTION_KEY=<generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
```

### 5. Start Hardhat local node
```bash
# In a separate terminal:
npx hardhat node
```

### 6. Deploy smart contract
```bash
npx hardhat run blockchain-scripts/deploy.js --network localhost
```

Copy the printed `CONTRACT_ADDRESS` into your `.env`.

Also add the backend signer key (Hardhat account #0):
```
BACKEND_SIGNER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
CONTRACT_ADDRESS=<from deploy output>
```

### 7. Seed demo accounts
```bash
cd backend
node src/utils/seed.js
```

### 8. Start the backend
```bash
cd backend
node server.js
# API running on http://localhost:5000
```

### 9. Start the frontend
```bash
cd frontend
npm run dev
# UI running on http://localhost:5173
```

### 10. (Optional) Import synthetic dataset
```bash
node dataset/import-script.js
```

---

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Patient | emma.wilson@patient.example | Patient@2024! |
| Doctor (Hosp A) | dr.johnson@hospitala.example | DrJohnson@2024! |
| Doctor (Hosp B) | dr.chen@hospitalb.example | DrChen@2024! |
| Hospital A Admin | admin@hospitala.example | HospA@dmin2024! |
| Hospital B Admin | admin@hospitalb.example | HospB@dmin2024! |
| System Admin | sysadmin@healthcare.example | SysAdmin@2024! |

---

## Running Tests

### Smart Contract Tests (46 tests)
```bash
npx hardhat test tests/contracts/MedicalRecords.test.js
```

### Backend API Tests
```bash
cd backend
npm test
```

### Security Tests
```bash
cd tests/security
npx jest security.test.js
```

---

## Performance Benchmarks
```bash
# Ensure Hardhat node is running and contract is deployed
node performance/benchmark.js

# Results saved to performance/results/benchmark-<timestamp>.csv
```

---

## End-to-End Demo Workflow

1. **Patient registered at Hospital A** — Login as emma.wilson
2. **Doctor A creates a record** — Login as dr.johnson, go to Create Record
3. **Record encrypted + blockchain hash** — Note the recordId and txHash
4. **Doctor B requests access** — Login as dr.chen, go to Request Access, enter recordId
5. **Patient grants consent** — Login as emma.wilson, go to Access Requests, click Grant
6. **Doctor B views the record** — Access the record; integrity verification shown
7. **Patient revokes access** — Click Revoke; Doctor B can no longer access
8. **Audit log** — Visit /audit for the full operation history

---

## MetaMask Configuration (optional, for direct wallet interactions)

1. Open MetaMask → Add Network
2. Network Name: Hardhat Local
3. RPC URL: http://127.0.0.1:8545
4. Chain ID: 31337
5. Import test accounts using private keys from `.env.example` comments

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `CONTRACT_ADDRESS not configured` | Deploy contract and update .env |
| `MongoDB connection error` | Ensure `mongod` is running |
| `RECORD_ENCRYPTION_KEY must be 64 hex chars` | Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| Blockchain tx fails | Ensure Hardhat node is running on port 8545 |
| Frontend CORS error | Check `FRONTEND_URL` in backend .env |

---

## Documentation

- `docs/research-methodology.md` — Experimental protocol and methodology
- `docs/security-evaluation.md` — Threat model and security test results
- `docs/api-reference.md` — Complete REST API reference
- `docs/smart-contract-design.md` — Contract architecture and state machines

---

## License

Research prototype. Not licensed for production or clinical use.
