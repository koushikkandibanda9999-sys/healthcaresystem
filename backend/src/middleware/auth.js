const jwt    = require("jsonwebtoken");
const config = require("../config");
const User   = require("../models/User");

/**
 * Verify JWT and attach req.user (without passwordHash).
 * All protected routes must use this middleware BEFORE rbac().
 */
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authentication token provided" });
    }
    const token   = header.split(" ")[1];
    const decoded = jwt.verify(token, config.jwtSecret);

    const user = await User.findById(decoded.userId).select("-passwordHash");
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Invalid or deactivated account" });
    }
    req.user = user;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }
    return res.status(401).json({ error: "Invalid token" });
  }
}

/**
 * Role-based access control middleware factory.
 * Usage: rbac("doctor", "hospitalAdmin")
 * Roles are checked SERVER-SIDE — never trust role from the request body.
 */
function rbac(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

/**
 * Generate a signed JWT for a user.
 */
function signToken(userId, role) {
  return jwt.sign({ userId, role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

module.exports = { authenticate, rbac, signToken };
