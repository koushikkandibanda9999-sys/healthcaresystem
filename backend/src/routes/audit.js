const express = require("express");
const router  = express.Router();
const { authenticate, rbac } = require("../middleware/auth");
const { getAuditLogs } = require("../controllers/auditController");

router.get("/", authenticate, rbac("patient", "doctor", "hospitalAdmin", "sysAdmin"), getAuditLogs);

module.exports = router;
