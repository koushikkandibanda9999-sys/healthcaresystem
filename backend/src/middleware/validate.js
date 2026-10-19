const { validationResult } = require("express-validator");

/**
 * Run validation result and return 400 with errors if any fail.
 * Use after express-validator chain definitions.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: "Validation failed", details: errors.array() });
  }
  next();
}

module.exports = { validate };
