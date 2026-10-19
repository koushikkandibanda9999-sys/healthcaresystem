const { body }  = require("express-validator");
const { validate } = require("../middleware/validate");
const { signToken } = require("../middleware/auth");
const User      = require("../models/User");
const Hospital  = require("../models/Hospital");
const audit     = require("../services/auditService");

// ── Validation chains ───────────────────────────────────────
const registerRules = [
  body("name").trim().notEmpty().withMessage("Name is required").isLength({ max: 120 }),
  body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
  body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
  body("role").isIn(["patient", "doctor", "hospitalAdmin"]).withMessage("Invalid role"),
  body("hospitalCode").optional().isString(),
];

const loginRules = [
  body("email").isEmail().normalizeEmail(),
  body("password").notEmpty(),
];

// ── Handlers ────────────────────────────────────────────────

async function register(req, res) {
  try {
    const { name, email, password, role, hospitalCode } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    let hospitalId = null;
    if (hospitalCode) {
      const hosp = await Hospital.findOne({ code: hospitalCode.toUpperCase(), isActive: true });
      if (!hosp) return res.status(400).json({ error: "Hospital not found" });
      hospitalId = hosp._id;
    }

    if ((role === "doctor" || role === "hospitalAdmin") && !hospitalId) {
      return res.status(400).json({ error: "Doctors and hospital admins require a valid hospitalCode" });
    }

    const passwordHash = await User.hashPassword(password);
    const user = await User.create({ name, email, passwordHash, role, hospitalId });

    const token = signToken(user._id, user.role);
    await audit.log({ actorId: user._id, actorRole: user.role, action: "USER_REGISTERED", outcome: "success" });

    return res.status(201).json({ token, user });
  } catch (err) {
    console.error("[Auth] register error:", err.message);
    return res.status(500).json({ error: "Registration failed" });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const match = await user.verifyPassword(password);
    if (!match) {
      await audit.log({ actorId: user._id, actorRole: user.role, action: "LOGIN_FAILED", outcome: "failure" });
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = signToken(user._id, user.role);
    await audit.log({ actorId: user._id, actorRole: user.role, action: "LOGIN_SUCCESS", outcome: "success" });
    return res.json({ token, user });
  } catch (err) {
    console.error("[Auth] login error:", err.message);
    return res.status(500).json({ error: "Login failed" });
  }
}

async function logout(req, res) {
  // JWT is stateless; logout is handled client-side by discarding the token.
  // A production system should maintain a token deny-list or use short-lived tokens.
  await audit.log({ actorId: req.user._id, actorRole: req.user.role, action: "LOGOUT", outcome: "success" });
  return res.json({ message: "Logged out. Discard your token." });
}

async function me(req, res) {
  return res.json({ user: req.user });
}

module.exports = {
  registerRules,
  loginRules,
  validate,
  register,
  login,
  logout,
  me,
};
