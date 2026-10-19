const express = require("express");
const router  = express.Router();
const { authenticate, rbac } = require("../middleware/auth");
const {
  createRecordRules, verifyRecordRules, validate,
  createRecord, getRecord, verifyRecord,
} = require("../controllers/recordController");

// Create a record (doctor only)
router.post("/", authenticate, rbac("doctor"), createRecordRules, validate, createRecord);

// Get a specific record (decrypted + verified, authorized users only)
router.get("/:id", authenticate, getRecord);

// Verify record integrity
router.post("/:id/verify", authenticate, verifyRecordRules, validate, verifyRecord);

module.exports = router;
