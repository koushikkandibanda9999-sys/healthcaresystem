# Security Evaluation and Threat Model

## 1. Threat Model

### 1.1 Assumed Trusted
- The backend service process (decryption occurs only here)
- The contract deployer / system administrator account
- The MongoDB database on the same trusted server

### 1.2 Assumed Untrusted
- Frontend JavaScript (all authorization re-checked server-side)
- Network traffic (HTTPS/TLS in production)
- Third-party hospital systems (authorized only after smart contract registration)
- Other users, including other hospitals and patients

### 1.3 Not in Scope
- Compromise of the backend server itself
- Compromise of the AES encryption key at rest
- Social engineering attacks

---

## 2. Security Controls

| Control | Implementation |
|---------|---------------|
| Authentication | JWT (HS256), bcrypt password hashing (cost 12) |
| Authorization | Server-side RBAC + on-chain consent checks |
| Data encryption | AES-256-GCM with unique IV per record |
| Integrity | SHA-256 hash registered on-chain before encryption |
| Access logging | Immutable append-only audit log |
| Input validation | express-validator on all endpoints |
| Rate limiting | 20 req/15min on auth, 120 req/min on API |
| CORS | Restricted to known frontend origin |
| HTTP headers | Helmet.js security headers |

---

## 3. Security Test Results

### Automated Tests (46 contract + 8 API security tests)

| Test Case | Expected | Result |
|-----------|----------|--------|
| Unauthenticated /api/records | 401 | PASS |
| Patient B reads Patient A record | 403 | PASS |
| Hospital B without consent | 403 | PASS |
| Patient creates record (wrong role) | 403 | PASS |
| Tampered JWT payload | 401 | PASS |
| Tampered encrypted record | Integrity fail | PASS |
| Duplicate access request | 409 | PASS |
| Non-existent record | 404 | PASS |
| Smart contract: unauthorized grant | Revert | PASS |
| Smart contract: access after revoke | false | PASS |
| Smart contract: expired access | false | PASS |
| Smart contract: hospital mismatch | Revert | PASS |

---

## 4. Known Limitations and Mitigations

### 4.1 Key Management (HIGH RISK in production)
**Issue:** AES key stored in `.env` environment variable.
**Mitigation (prototype):** Key loaded at startup, never logged or stored in DB.
**Required for production:** AWS KMS, Azure Key Vault, or HSM with per-record or envelope-key encryption.

### 4.2 Patient Wallet Signing
**Issue:** In this prototype, patient consent transactions are signed by a backend-held key.
**Mitigation:** Documented limitation. Production system requires MetaMask/WalletConnect.
**Risk:** Backend compromise could allow unauthorized consent transactions.

### 4.3 Revocation Limitations
**Issue:** Access revocation cannot erase data already retrieved and stored by an authorized recipient.
**Mitigation:** Clearly documented. Patients are warned before revoking.
**Note:** This is an inherent limitation of any consent-based system, not a bug.

### 4.4 Hash Is Not Anonymization
**Issue:** A SHA-256 hash of medical content does not protect patient identity.
**Mitigation:** No PHI in on-chain events. Content hash alone does not reveal clinical data.
**Note:** Records are identified by opaque addresses, not patient names.

### 4.5 Local Chain Has No Network Security
**Issue:** Hardhat local node has no TLS, no authentication.
**Mitigation:** Development only. Production requires TLS-secured RPC with authentication.

---

## 5. Security Recommendations for Production

1. Replace `.env` key with KMS-managed envelope keys (one key per record or per patient).
2. Require patient wallet signatures via MetaMask for all consent transactions.
3. Add token deny-list or short-lived (15-minute) access tokens.
4. TLS/mTLS between backend and RPC node.
5. Regular dependency audits (`npm audit`).
6. Penetration testing before any production deployment.
7. Privacy impact assessment under applicable healthcare regulations (HIPAA, GDPR).
