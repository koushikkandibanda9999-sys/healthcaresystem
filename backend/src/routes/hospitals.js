const express = require("express");
const router  = express.Router();
const { authenticate, rbac } = require("../middleware/auth");
const {
  registerHospitalRules, validate,
  registerHospital, getHospitals, getHospital, getHospitalDoctors,
} = require("../controllers/hospitalController");

router.get("/",              authenticate, getHospitals);
router.post("/register",     authenticate, rbac("sysAdmin"), registerHospitalRules, validate, registerHospital);
router.get("/:id",           authenticate, getHospital);
router.get("/:id/doctors",   authenticate, rbac("sysAdmin", "hospitalAdmin"), getHospitalDoctors);

module.exports = router;
