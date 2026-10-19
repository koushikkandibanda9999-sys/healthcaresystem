const express = require("express");
const router  = express.Router();
const { authenticate, rbac } = require("../middleware/auth");
const {
  getMyProfile, getMyRecords, getMyAccessRequests,
  updateWalletAddress, getUsers,
} = require("../controllers/patientController");

// Patient self-service
router.get("/me",              authenticate, rbac("patient"), getMyProfile);
router.get("/me/records",      authenticate, rbac("patient"), getMyRecords);
router.get("/me/access-requests", authenticate, rbac("patient"), getMyAccessRequests);
router.put("/me/wallet",       authenticate, rbac("patient"), updateWalletAddress);

// Doctor/admin can lookup patient records by patient ID (via /records/:patientId)
router.get("/:patientId/records", authenticate, rbac("doctor", "hospitalAdmin", "sysAdmin"), require("../controllers/recordController").getPatientRecords);

// Admin user management
router.get("/", authenticate, rbac("sysAdmin", "hospitalAdmin"), getUsers);

module.exports = router;
