# Research Methodology and Evaluation Protocol

## Title
Design and Performance Evaluation of a Patient-Centric Permissioned Blockchain Framework for Consent-Controlled and Verifiable Inter-Hospital Medical Record Exchange

---

## 1. Research Objectives

1. Design and implement a consent-controlled medical record exchange framework using blockchain smart contracts.
2. Evaluate system performance under different workload sizes.
3. Measure security properties through negative and adversarial testing.
4. Document limitations and future directions.

---

## 2. System Architecture

### 2.1 Blockchain Layer (Research Prototype)

This prototype uses a local EVM-compatible chain (Hardhat) with Solidity smart contracts.

**Important Disclaimer:** This is a permissioned-style research prototype. It uses on-chain role-based access control (RBAC) and authorized participant registration to simulate the access restrictions of a permissioned network. It is **NOT** a genuine Hyperledger Fabric deployment. The design is modular so that a Fabric SDK adapter can replace the EVM adapter in future work without changing business logic.

### 2.2 Off-chain Storage

Medical record content is encrypted (AES-256-GCM) and stored off-chain. The blockchain stores only:
- Content hash (SHA-256)
- Record reference (UUID-as-bytes32)
- Patient and hospital addresses
- Consent state

### 2.3 Consent Model

The consent workflow follows a state machine:
```
None → Pending → Granted ─→ Revoked
               └→ Denied
```

---

## 3. Experimental Setup

### 3.1 Hardware Configuration
- Record the machine's CPU, RAM, OS, and Node.js version when running benchmarks.
- Example: Intel Core i7, 16 GB RAM, Windows 11, Node.js 22.x, Hardhat 2.22.x.

### 3.2 Software Configuration
- Hardhat local blockchain: `chainId=31337`, automine mode.
- MongoDB Community Edition 7.x.
- ethers.js 6.x.

### 3.3 Workload Sizes
Performance experiments use N ∈ {10, 50, 100} operations with TRIALS=3 repeated measurements.
A full evaluation should include N=500. For N=500, allow 30–60 minutes per workload.

---

## 4. Performance Metrics

| Metric | Definition | Tool |
|--------|-----------|------|
| Transaction latency | Wall-clock time from `contract.method()` call to `receipt.wait()` | `Date.now()` |
| Consent grant latency | Time for patient to grant access including blockchain confirmation | Benchmark script |
| Verification latency | Time for `checkRecordHash` view call | Benchmark script |
| Throughput | Total operations / total elapsed time in seconds | Derived |
| Gas per operation | `receipt.gasUsed` from each transaction | ethers.js receipt |
| Error rate | `errors / totalAttempts × 100%` | Benchmark script |
| Backend API latency | Express response time for each endpoint | Separate API bench |

### 4.1 Statistical Analysis
- Report mean, median, and p95 latency for each operation type.
- Use TRIALS=3 repeated measurements at each workload level.
- Separate blockchain confirmation time from backend processing time.

---

## 5. Security Evaluation

### 5.1 Tests Performed
See `tests/security/security.test.js` for automated tests:
- Unauthenticated access (401 expected)
- Cross-patient access (403 expected)
- Unauthorized hospital access without consent (403 expected)
- Wrong role enforcement (403 expected)
- Tampered record detection (integrity check fails)
- Invalid/expired token (401 expected)
- Duplicate request detection (409 expected)
- Input validation (400 expected)

### 5.2 Smart Contract Security Tests
See `tests/contracts/MedicalRecords.test.js` (46 tests):
- Unauthorized participant registration
- Unauthorized record registration
- Cross-patient grant attempts
- Access after denial, revocation, and expiry
- Hash mismatch detection

### 5.3 Known Limitations
1. **Key management:** The AES-256-GCM key is loaded from `.env` (development only). A production system MUST use a KMS/HSM.
2. **Patient wallet signing:** In this prototype, patient consent is signed by a backend-held key (Hardhat test account). A production system requires the patient to sign with their own wallet (MetaMask).
3. **Revocation scope:** Revoking access prevents future retrieval through this system. It cannot erase data already downloaded by an authorized recipient.
4. **Local chain:** Measurements reflect a single-node local EVM chain. Results are not comparable to production permissioned networks.
5. **No formal verification:** Smart contract security is tested but not formally proved.
6. **Audit log integrity:** Application-layer audit logs are append-only but not cryptographically verified. Consider append-only blockchain event logs for stronger audit guarantees.

---

## 6. Comparison with Related Work

This prototype does not claim novelty solely from its title. The following gap mapping identifies what this work demonstrates experimentally:

| Aspect | Related Work | This Prototype |
|--------|-------------|----------------|
| Patient consent control | Proposed in [Azaria 2016], [Xia 2017] | Implemented and tested |
| Smart contract consent enforcement | Proposed in multiple papers | Implemented with negative tests |
| AES-256-GCM off-chain encryption | Standard practice | Integrated with consent checks |
| Hash-based integrity verification | Standard practice | Verified against on-chain hash |
| Performance measurement | Claimed without data in many papers | Measured with raw CSV export |
| Revocation semantics | Often unclear | Explicitly documented with limitations |

Key research contribution: A complete, runnable prototype with measured performance data, documented security limitations, and reproducible experiments — distinguishing it from theoretical proposals or partial implementations.

---

## 7. Literature Comparison

1. Azaria A. et al. (2016) MedRec — EHR management using blockchain. Proposed but not fully implemented.
2. Xia Q. et al. (2017) MeDShare — data sharing using blockchain. Focuses on cloud data, not AES-GCM encryption.
3. Gordon W., Catalini C. (2018) Blockchain in healthcare — review. No implementation.
4. Shahnaz A. et al. (2019) EHR using Hyperledger Fabric — organizational MSP-based permissioning. Different from EVM RBAC.

This prototype: Complete runnable system with smart contract tests, measured performance, documented limitations.

---

## 8. Reproducibility

To reproduce all experiments:
1. Install Node.js, MongoDB, and Git.
2. Clone repository and run `npm install` in root, backend, and frontend.
3. Start MongoDB: `mongod`.
4. Start Hardhat node: `npx hardhat node`.
5. Deploy contract: `npx hardhat run blockchain-scripts/deploy.js --network localhost`.
6. Copy `CONTRACT_ADDRESS` from output into `.env`.
7. Seed accounts: `cd backend && node src/utils/seed.js`.
8. Run contract tests: `npx hardhat test tests/contracts/MedicalRecords.test.js`.
9. Run benchmark: `node performance/benchmark.js`.
10. Export CSV from `performance/results/`.

---

## 9. Threats to Validity

- **Internal validity:** Benchmark results depend on local hardware. Record your machine specifications.
- **External validity:** Local EVM latency is not representative of production blockchain performance.
- **Construct validity:** Gas cost measures local EVM computation, not a real network's gas price.
- **Synthetic data:** All clinical content is synthetic. No conclusions about real clinical workflows are claimed.
