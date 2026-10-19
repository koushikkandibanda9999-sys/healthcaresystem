const express = require("express");
const router  = express.Router();
const { authenticate, rbac } = require("../middleware/auth");
const { getResults, getGasReport } = require("../controllers/performanceController");

router.get("/results",    authenticate, rbac("sysAdmin", "hospitalAdmin"), getResults);
router.get("/gas-report", authenticate, rbac("sysAdmin"), getGasReport);

module.exports = router;
