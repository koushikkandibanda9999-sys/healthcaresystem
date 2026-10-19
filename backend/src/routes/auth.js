const express = require("express");
const router  = express.Router();
const { authLimiter } = require("../middleware/rateLimiter");
const { authenticate } = require("../middleware/auth");
const {
  registerRules, loginRules, validate,
  register, login, logout, me,
} = require("../controllers/authController");

router.post("/register", authLimiter, registerRules, validate, register);
router.post("/login",    authLimiter, loginRules, validate, login);
router.post("/logout",   authenticate, logout);
router.get("/me",        authenticate, me);

module.exports = router;
