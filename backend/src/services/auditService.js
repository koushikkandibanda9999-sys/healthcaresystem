const AuditLog = require("../models/AuditLog");

/**
 * Append-only audit log writer.
 * Errors are caught and logged to stderr; they never propagate to the
 * caller so that an audit-write failure does not break the main workflow.
 */
async function log({ actorId, actorRole, hospitalId, action, recordId, requestId, outcome = "success", blockchainTxHash, detail }) {
  try {
    await AuditLog.create({
      actorId,
      actorRole,
      hospitalId,
      action,
      recordId,
      requestId,
      outcome,
      blockchainTxHash,
      detail,
    });
  } catch (err) {
    console.error("[AuditService] Failed to write audit log:", err.message);
  }
}

async function query({ actorId, hospitalId, recordId, action, limit = 100, skip = 0 } = {}) {
  const filter = {};
  if (actorId)    filter.actorId   = actorId;
  if (hospitalId) filter.hospitalId = hospitalId;
  if (recordId)   filter.recordId  = recordId;
  if (action)     filter.action    = action;

  return AuditLog.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
}

module.exports = { log, query };
