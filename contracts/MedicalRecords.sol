// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MedicalRecords
 * @notice Patient-centric consent-controlled medical record registry.
 *
 * Architecture note
 * -----------------
 * This contract is the core of a permissioned-style research prototype built on a
 * local EVM-compatible chain (Hardhat).  It is NOT a production Hyperledger Fabric
 * network.  Access control is enforced by on-chain role checks rather than by a
 * Fabric MSP.  The design is intentionally modular so the off-chain backend can
 * swap this EVM adapter for a Fabric SDK adapter without changing business logic.
 *
 * What lives on-chain
 * -------------------
 *   - Hospital and doctor registrations (addresses only).
 *   - Record references: SHA-256 content hash, patient address, hospital address,
 *     record type category, creation timestamp.
 *   - Access-request state machines (pending → granted/denied → revoked).
 *   - Consent grant scope and expiry.
 *   - Audit events (emitted, not stored, to keep gas low).
 *
 * What NEVER lives on-chain
 * -------------------------
 *   - Patient names, diagnoses, medications, or any clinical text.
 *   - Encryption keys.
 *   - Encrypted or decrypted file bytes.
 *   - Personally identifiable information beyond opaque addresses.
 */

contract MedicalRecords {

    // =========================================================
    //  Enums
    // =========================================================

    enum AccessStatus { None, Pending, Granted, Denied, Revoked }

    // =========================================================
    //  Structs
    // =========================================================

    struct Hospital {
        address addr;
        string  name;
        bool    active;
    }

    struct Doctor {
        address addr;
        address hospitalAddr;
        bool    active;
    }

    struct Record {
        bytes32 recordId;       // off-chain UUID as bytes32
        bytes32 contentHash;    // SHA-256 of canonical plaintext JSON
        address patientAddr;
        address hospitalAddr;
        string  recordCategory; // e.g. "ENCOUNTER", "LAB", "PRESCRIPTION"
        uint256 createdAt;
        bool    active;
    }

    struct AccessGrant {
        address  requestingHospital;
        string   scope;            // requested record category or "*"
        uint256  expiryTimestamp;  // 0 means no expiry
        AccessStatus status;
        uint256  grantedAt;
        uint256  revokedAt;
    }

    // =========================================================
    //  State
    // =========================================================

    address public owner;

    mapping(address => Hospital)             public hospitals;
    mapping(address => Doctor)               public doctors;
    // recordId → Record
    mapping(bytes32 => Record)               public records;
    // recordId → requestingHospital → AccessGrant
    mapping(bytes32 => mapping(address => AccessGrant)) public accessGrants;
    // patientAddr → list of their recordIds (for enumeration)
    mapping(address => bytes32[])            private patientRecords;
    // recordId → list of requesting hospitals (for enumeration)
    mapping(bytes32 => address[])            private recordRequestors;

    address[] private hospitalList;
    address[] private doctorList;

    // =========================================================
    //  Events
    // =========================================================

    event HospitalRegistered(address indexed hospitalAddr, string name, uint256 timestamp);
    event HospitalDeactivated(address indexed hospitalAddr, uint256 timestamp);
    event DoctorRegistered(address indexed doctorAddr, address indexed hospitalAddr, uint256 timestamp);
    event DoctorDeactivated(address indexed doctorAddr, uint256 timestamp);

    event RecordRegistered(
        bytes32 indexed recordId,
        bytes32         contentHash,
        address indexed patientAddr,
        address indexed hospitalAddr,
        string          recordCategory,
        uint256         timestamp
    );

    event AccessRequested(
        bytes32 indexed recordId,
        address indexed requestingHospital,
        string          scope,
        uint256         timestamp
    );

    event AccessGranted(
        bytes32 indexed recordId,
        address indexed requestingHospital,
        uint256         expiryTimestamp,
        uint256         timestamp
    );

    event AccessDenied(
        bytes32 indexed recordId,
        address indexed requestingHospital,
        uint256         timestamp
    );

    event AccessRevoked(
        bytes32 indexed recordId,
        address indexed requestingHospital,
        uint256         timestamp
    );

    event RecordAccessed(
        bytes32 indexed recordId,
        address indexed accessedBy,
        uint256         timestamp
    );

    event RecordHashVerified(
        bytes32 indexed recordId,
        bool            matched,
        uint256         timestamp
    );

    // =========================================================
    //  Modifiers
    // =========================================================

    modifier onlyOwner() {
        require(msg.sender == owner, "MR: not owner");
        _;
    }

    modifier onlyActiveHospital() {
        require(hospitals[msg.sender].active, "MR: caller not active hospital");
        _;
    }

    modifier onlyActiveDoctor() {
        require(doctors[msg.sender].active, "MR: caller not active doctor");
        _;
    }

    modifier recordExists(bytes32 recordId) {
        require(records[recordId].active, "MR: record not found or inactive");
        _;
    }

    // =========================================================
    //  Constructor
    // =========================================================

    constructor() {
        owner = msg.sender;
    }

    // =========================================================
    //  Hospital management
    // =========================================================

    /**
     * @notice Register a hospital address.  Only the contract owner (system admin
     *         backend signer) may call this.
     */
    function registerHospital(address hospitalAddr, string calldata name)
        external
        onlyOwner
    {
        require(hospitalAddr != address(0), "MR: zero address");
        require(bytes(name).length > 0, "MR: empty name");
        require(!hospitals[hospitalAddr].active, "MR: already registered");

        hospitals[hospitalAddr] = Hospital({
            addr:   hospitalAddr,
            name:   name,
            active: true
        });
        hospitalList.push(hospitalAddr);

        emit HospitalRegistered(hospitalAddr, name, block.timestamp);
    }

    function deactivateHospital(address hospitalAddr) external onlyOwner {
        require(hospitals[hospitalAddr].active, "MR: not active");
        hospitals[hospitalAddr].active = false;
        emit HospitalDeactivated(hospitalAddr, block.timestamp);
    }

    // =========================================================
    //  Doctor management
    // =========================================================

    /**
     * @notice Register a doctor under an active hospital.
     *         Can be called by the contract owner OR by the hospital itself.
     */
    function registerDoctor(address doctorAddr, address hospitalAddr) external {
        require(
            msg.sender == owner || msg.sender == hospitalAddr,
            "MR: not authorized to register doctor"
        );
        require(hospitals[hospitalAddr].active, "MR: hospital not active");
        require(doctorAddr != address(0), "MR: zero address");
        require(!doctors[doctorAddr].active, "MR: already registered");

        doctors[doctorAddr] = Doctor({
            addr:        doctorAddr,
            hospitalAddr: hospitalAddr,
            active:      true
        });
        doctorList.push(doctorAddr);

        emit DoctorRegistered(doctorAddr, hospitalAddr, block.timestamp);
    }

    function deactivateDoctor(address doctorAddr) external {
        require(
            msg.sender == owner ||
            msg.sender == doctors[doctorAddr].hospitalAddr,
            "MR: not authorized"
        );
        require(doctors[doctorAddr].active, "MR: not active");
        doctors[doctorAddr].active = false;
        emit DoctorDeactivated(doctorAddr, block.timestamp);
    }

    // =========================================================
    //  Record management
    // =========================================================

    /**
     * @notice Register a medical record reference on-chain.
     *         Only a doctor whose hospital matches hospitalAddr may call this.
     * @param recordId       UUID-as-bytes32 (off-chain primary key).
     * @param contentHash    SHA-256 of canonical plaintext JSON record.
     * @param patientAddr    Patient's registered wallet address.
     * @param hospitalAddr   Hospital that owns this record.
     * @param recordCategory Short category string, e.g. "ENCOUNTER".
     */
    function registerRecord(
        bytes32 recordId,
        bytes32 contentHash,
        address patientAddr,
        address hospitalAddr,
        string  calldata recordCategory
    ) external onlyActiveDoctor {
        require(doctors[msg.sender].hospitalAddr == hospitalAddr, "MR: hospital mismatch");
        require(hospitals[hospitalAddr].active,  "MR: hospital not active");
        require(patientAddr != address(0),        "MR: zero patient");
        require(contentHash != bytes32(0),        "MR: empty hash");
        require(!records[recordId].active,        "MR: duplicate recordId");

        records[recordId] = Record({
            recordId:       recordId,
            contentHash:    contentHash,
            patientAddr:    patientAddr,
            hospitalAddr:   hospitalAddr,
            recordCategory: recordCategory,
            createdAt:      block.timestamp,
            active:         true
        });

        patientRecords[patientAddr].push(recordId);

        emit RecordRegistered(
            recordId,
            contentHash,
            patientAddr,
            hospitalAddr,
            recordCategory,
            block.timestamp
        );
    }

    // =========================================================
    //  Access-request workflow
    // =========================================================

    /**
     * @notice A hospital requests access to a specific record.
     *         The requesting hospital must be registered and active.
     */
    function requestAccess(
        bytes32 recordId,
        string  calldata scope
    )
        external
        onlyActiveHospital
        recordExists(recordId)
    {
        AccessGrant storage g = accessGrants[recordId][msg.sender];
        require(
            g.status == AccessStatus.None ||
            g.status == AccessStatus.Denied ||
            g.status == AccessStatus.Revoked,
            "MR: request already pending or granted"
        );
        // Requesting own hospital's records is not an inter-hospital operation
        require(
            msg.sender != records[recordId].hospitalAddr,
            "MR: cannot request own hospital's record"
        );

        g.requestingHospital = msg.sender;
        g.scope              = scope;
        g.status             = AccessStatus.Pending;
        g.expiryTimestamp    = 0;
        g.grantedAt          = 0;
        g.revokedAt          = 0;

        // Track requestor for enumeration (avoid duplicates)
        address[] storage rq = recordRequestors[recordId];
        bool found = false;
        for (uint i = 0; i < rq.length; i++) {
            if (rq[i] == msg.sender) { found = true; break; }
        }
        if (!found) rq.push(msg.sender);

        emit AccessRequested(recordId, msg.sender, scope, block.timestamp);
    }

    /**
     * @notice Patient grants access to a specific hospital.
     *         Only the patient who owns the record may call this.
     * @param expiryTimestamp  Unix timestamp after which access expires; 0 = no expiry.
     */
    function grantAccess(
        bytes32 recordId,
        address requestingHospital,
        uint256 expiryTimestamp
    )
        external
        recordExists(recordId)
    {
        require(
            msg.sender == records[recordId].patientAddr,
            "MR: only patient can grant access"
        );
        require(hospitals[requestingHospital].active, "MR: requesting hospital not active");

        AccessGrant storage g = accessGrants[recordId][requestingHospital];
        require(
            g.status == AccessStatus.Pending ||
            g.status == AccessStatus.Denied ||
            g.status == AccessStatus.Revoked,
            "MR: already granted"
        );
        require(
            expiryTimestamp == 0 || expiryTimestamp > block.timestamp,
            "MR: expiry in the past"
        );

        g.status          = AccessStatus.Granted;
        g.expiryTimestamp = expiryTimestamp;
        g.grantedAt       = block.timestamp;
        g.revokedAt       = 0;

        emit AccessGranted(recordId, requestingHospital, expiryTimestamp, block.timestamp);
    }

    /**
     * @notice Patient denies an access request.
     */
    function denyAccess(bytes32 recordId, address requestingHospital)
        external
        recordExists(recordId)
    {
        require(
            msg.sender == records[recordId].patientAddr,
            "MR: only patient can deny"
        );
        AccessGrant storage g = accessGrants[recordId][requestingHospital];
        require(g.status == AccessStatus.Pending, "MR: not pending");

        g.status = AccessStatus.Denied;

        emit AccessDenied(recordId, requestingHospital, block.timestamp);
    }

    /**
     * @notice Patient revokes a previously granted access.
     *         Does not erase copies already downloaded by the authorized recipient.
     */
    function revokeAccess(bytes32 recordId, address requestingHospital)
        external
        recordExists(recordId)
    {
        require(
            msg.sender == records[recordId].patientAddr,
            "MR: only patient can revoke"
        );
        AccessGrant storage g = accessGrants[recordId][requestingHospital];
        require(g.status == AccessStatus.Granted, "MR: not currently granted");

        g.status    = AccessStatus.Revoked;
        g.revokedAt = block.timestamp;

        emit AccessRevoked(recordId, requestingHospital, block.timestamp);
    }

    // =========================================================
    //  Query functions
    // =========================================================

    /**
     * @notice Returns true if requestingHospital currently has valid (non-expired,
     *         non-revoked, non-denied) access to recordId.
     */
    function isAccessGranted(bytes32 recordId, address requestingHospital)
        external
        view
        returns (bool)
    {
        AccessGrant storage g = accessGrants[recordId][requestingHospital];
        if (g.status != AccessStatus.Granted) return false;
        if (g.expiryTimestamp != 0 && block.timestamp > g.expiryTimestamp) return false;
        return true;
    }

    /**
     * @notice Returns the raw access grant status without expiry evaluation.
     */
    function getAccessStatus(bytes32 recordId, address requestingHospital)
        external
        view
        returns (AccessStatus)
    {
        return accessGrants[recordId][requestingHospital].status;
    }

    /**
     * @notice Verify that a submitted hash matches the registered hash.
     *         Emits an event for audit purposes.
     * @return matched  True if hashes are equal.
     */
    function verifyRecordHash(bytes32 recordId, bytes32 submittedHash)
        external
        recordExists(recordId)
        returns (bool matched)
    {
        matched = (records[recordId].contentHash == submittedHash);
        emit RecordHashVerified(recordId, matched, block.timestamp);
    }

    /**
     * @notice Pure hash comparison without state change (for read-only checks).
     */
    function checkRecordHash(bytes32 recordId, bytes32 submittedHash)
        external
        view
        recordExists(recordId)
        returns (bool)
    {
        return (records[recordId].contentHash == submittedHash);
    }

    /**
     * @notice Emit a RecordAccessed event (called by the backend after authorized retrieval).
     */
    function logRecordAccess(bytes32 recordId)
        external
        recordExists(recordId)
    {
        // Only a registered doctor or hospital may log access
        require(
            doctors[msg.sender].active || hospitals[msg.sender].active,
            "MR: unauthorized logger"
        );
        emit RecordAccessed(recordId, msg.sender, block.timestamp);
    }

    // =========================================================
    //  Enumeration helpers
    // =========================================================

    function getPatientRecordIds(address patientAddr)
        external
        view
        returns (bytes32[] memory)
    {
        return patientRecords[patientAddr];
    }

    function getRecordRequestors(bytes32 recordId)
        external
        view
        returns (address[] memory)
    {
        return recordRequestors[recordId];
    }

    function getHospitalList() external view returns (address[] memory) {
        return hospitalList;
    }

    function getDoctorList() external view returns (address[] memory) {
        return doctorList;
    }
}
