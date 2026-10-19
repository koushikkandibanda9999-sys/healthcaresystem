const express = require("express");
const router  = express.Router();
const { authenticate, rbac } = require("../middleware/auth");
const {
  requestAccessRules, grantDenyRules, validate,
  requestAccess, getAccessRequests,
  grantAccess, denyAccess, revokeAccess,
} = require("../controllers/accessController");

// Doctor/HospAdmin requests access to a record at another hospital
router.post("/",              authenticate, rbac("doctor", "hospitalAdmin"), requestAccessRules, validate, requestAccess);

// List access requests (filtered by role)
router.get("/",               authenticate, getAccessRequests);

// Patient actions on access requests
router.post("/:id/grant",     authenticate, rbac("patient"), grantDenyRules, validate, grantAccess);
router.post("/:id/deny",      authenticate, rbac("patient"), denyAccess);

// Revoke a previously granted access
router.post("/:id/revoke",    authenticate, rbac("patient"), revokeAccess);

module.exports = router;
