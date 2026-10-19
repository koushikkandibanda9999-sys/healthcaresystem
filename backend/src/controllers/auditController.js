const auditService = require("../services/auditService");

async function getAuditLogs(req, res) {
  try {
    const { recordId, action, limit = 100, skip = 0 } = req.query;
    const filter = {};

    // Patients only see their own record audit entries
    if (req.user.role === "patient") {
      // audits are linked by actorId or we search by recordId
      // return only actions where they are the actor or the record belongs to them
      filter.actorId = req.user._id;
    } else if (req.user.role === "doctor" || req.user.role === "hospitalAdmin") {
      filter.hospitalId = req.user.hospitalId;
    }
    // sysAdmin sees everything

    if (recordId) filter.recordId = recordId;
    if (action)   filter.action   = action;

    const logs = await auditService.query({
      ...filter,
      limit: Math.min(Number(limit), 500),
      skip: Number(skip),
    });

    return res.json({ logs, count: logs.length });
  } catch (err) {
    console.error("[AuditController]", err.message);
    return res.status(500).json({ error: "Failed to fetch audit logs" });
  }
}

module.exports = { getAuditLogs };
