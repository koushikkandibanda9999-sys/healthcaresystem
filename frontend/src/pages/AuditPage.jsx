import { useState, useEffect } from "react";
import Layout from "../components/Layout";
import Spinner from "../components/Spinner";
import { auditApi } from "../api/client";

const ACTION_COLORS = {
  RECORD_CREATED: "success", ACCESS_GRANTED: "success", LOGIN_SUCCESS: "info",
  RECORD_ACCESSED: "info", RECORD_VERIFIED: "info",
  ACCESS_REQUESTED: "warning",
  ACCESS_DENIED: "danger", ACCESS_REVOKED: "danger", RECORD_ACCESS_DENIED: "danger", LOGIN_FAILED: "danger",
};

export default function AuditPage() {
  const [logs, setLogs]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState("");

  useEffect(() => {
    auditApi.logs({ limit: 200 })
      .then(res => setLogs(res.data.logs || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter
    ? logs.filter(l => l.action.includes(filter.toUpperCase()) || l.recordId?.includes(filter))
    : logs;

  return (
    <Layout title="Audit Log" subtitle="Privacy-aware operation history">
      <div className="mb-3 d-flex gap-2 align-items-center">
        <input className="form-control" style={{ maxWidth: 300 }} placeholder="Filter by action or record ID…"
          value={filter} onChange={e => setFilter(e.target.value)} />
        <span className="text-muted small">{filtered.length} entries</span>
      </div>

      <div className="table-card">
        {loading ? <Spinner /> : (
          <>
            {!filtered.length ? (
              <div className="p-4 text-center text-muted small">No audit logs found.</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm">
                  <thead>
                    <tr><th>Time</th><th>Action</th><th>Role</th><th>Record</th><th>Outcome</th><th>Tx Hash</th><th>Detail</th></tr>
                  </thead>
                  <tbody>
                    {filtered.map(l => (
                      <tr key={l._id}>
                        <td className="small text-muted text-nowrap">{new Date(l.createdAt).toLocaleString()}</td>
                        <td>
                          <span className={`badge bg-${ACTION_COLORS[l.action] || "secondary"}-subtle text-${ACTION_COLORS[l.action] || "secondary"} small`}>
                            {l.action}
                          </span>
                        </td>
                        <td className="small">{l.actorRole || "—"}</td>
                        <td><span className="hash-text">{l.recordId?.slice(0, 10) || "—"}</span></td>
                        <td>
                          <i className={`bi ${l.outcome === "success" ? "bi-check-circle text-success" : l.outcome === "failure" ? "bi-x-circle text-danger" : "bi-info-circle text-info"}`}></i>
                        </td>
                        <td><span className="hash-text">{l.blockchainTxHash?.slice(0, 10) || "—"}</span></td>
                        <td className="small text-muted">{l.detail?.slice(0, 60) || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-3 p-3 bg-light rounded-2 small text-muted">
        <i className="bi bi-info-circle me-2"></i>
        Audit logs contain only identifiers and action codes. No patient names, diagnoses, clinical content, or encryption keys are stored here.
        On-chain events are separate from these application logs.
      </div>
    </Layout>
  );
}
