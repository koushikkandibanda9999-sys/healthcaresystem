import { useState, useEffect } from "react";
import { Routes, Route, Link } from "react-router-dom";
import Layout from "../components/Layout";
import Spinner from "../components/Spinner";
import StatusBadge from "../components/StatusBadge";
import Alert from "../components/Alert";
import { useAuth } from "../hooks/useAuth";
import { patients, records as recordsApi, access } from "../api/client";

// ── Overview ──────────────────────────────────────────────────
function Overview({ user }) {
  const [stats, setStats] = useState({ records: 0, pending: 0, granted: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([patients.myRecords(), patients.myRequests()])
      .then(([rRes, aRes]) => {
        const reqs = aRes.data.accessRequests;
        setStats({
          records: rRes.data.records.length,
          pending: reqs.filter(r => r.status === "pending").length,
          granted: reqs.filter(r => r.status === "granted").length,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="row g-3 mb-4">
        {[
          { label: "My Records",       value: stats.records,  icon: "bi-file-medical", color: "#0d6efd" },
          { label: "Pending Requests", value: stats.pending,  icon: "bi-inbox",        color: "#ffc107" },
          { label: "Active Grants",    value: stats.granted,  icon: "bi-check-circle", color: "#198754" },
        ].map(s => (
          <div className="col-sm-4" key={s.label}>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: s.color + "20" }}>
                <i className={`bi ${s.icon}`} style={{ color: s.color }}></i>
              </div>
              <div>
                <div className="fw-bold fs-4">{s.value}</div>
                <div className="text-muted small">{s.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 bg-primary-subtle rounded-3 mb-4">
        <h6 className="fw-bold"><i className="bi bi-person-circle me-2"></i>{user.name}</h6>
        <p className="small text-muted mb-0">Wallet: {user.walletAddress || <span className="text-danger">Not configured — set in profile</span>}</p>
      </div>

      <div className="row g-3">
        <div className="col-md-6">
          <div className="card h-100">
            <div className="card-body">
              <h6 className="fw-bold"><i className="bi bi-inbox me-2 text-warning"></i>Pending Access Requests</h6>
              <p className="small text-muted">Hospitals requesting access to your records will appear here for your approval.</p>
              <Link to="/patient/requests" className="btn btn-sm btn-outline-warning">View Requests</Link>
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card h-100">
            <div className="card-body">
              <h6 className="fw-bold"><i className="bi bi-file-medical me-2 text-primary"></i>My Medical Records</h6>
              <p className="small text-muted">View, verify, and manage access to your encrypted medical records.</p>
              <Link to="/patient/records" className="btn btn-sm btn-outline-primary">View Records</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Records List ──────────────────────────────────────────────
function MyRecords() {
  const [recs, setRecs]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(null);
  const [verResult, setVerResult] = useState({});

  useEffect(() => {
    patients.myRecords()
      .then(res => setRecs(res.data.records))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleVerify(recordId) {
    setVerifying(recordId);
    try {
      const res = await recordsApi.verify(recordId);
      setVerResult(prev => ({ ...prev, [recordId]: res.data }));
    } catch (err) {
      setVerResult(prev => ({ ...prev, [recordId]: { error: err.response?.data?.error || "Verification failed" } }));
    } finally {
      setVerifying(null);
    }
  }

  if (loading) return <Spinner />;
  if (!recs.length) return (
    <div className="empty-state">
      <i className="bi bi-file-medical"></i>
      <h6>No medical records yet</h6>
      <p className="small">Records created by your doctor will appear here.</p>
    </div>
  );

  return (
    <div className="table-card">
      <div className="table-header"><h6 className="mb-0 fw-bold">My Medical Records ({recs.length})</h6></div>
      <div className="table-responsive">
        <table className="table table-hover">
          <thead>
            <tr>
              <th>Type</th><th>Hospital</th><th>Doctor</th><th>Date</th><th>Hash</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {recs.map(r => (
              <tr key={r._id}>
                <td><span className="badge bg-info-subtle text-info">{r.recordType}</span></td>
                <td>{r.hospitalId?.name || "—"}</td>
                <td>{r.doctorId?.name || "—"}</td>
                <td className="small text-muted">{new Date(r.createdAt).toLocaleDateString()}</td>
                <td><span className="hash-text">{r.contentHash?.slice(0, 16)}…</span></td>
                <td>
                  <div className="d-flex gap-1">
                    <Link to={`/records/${r.recordId}`} className="btn btn-xs btn-outline-primary btn-sm">View</Link>
                    <button
                      className="btn btn-sm btn-outline-success"
                      onClick={() => handleVerify(r.recordId)}
                      disabled={verifying === r.recordId}
                    >
                      {verifying === r.recordId ? <span className="spinner-border spinner-border-sm" /> : "Verify"}
                    </button>
                  </div>
                  {verResult[r.recordId] && (
                    <div className={`mt-1 small ${verResult[r.recordId].overallVerified ? "text-success" : "text-danger"}`}>
                      {verResult[r.recordId].error || (verResult[r.recordId].overallVerified ? "✓ Verified" : "✗ Tampered!")}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Access Requests ───────────────────────────────────────────
function AccessRequests() {
  const [reqs, setReqs]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]     = useState(null);
  const [msg, setMsg]       = useState(null);
  const [expiry, setExpiry] = useState({});

  useEffect(() => {
    patients.myRequests()
      .then(res => setReqs(res.data.accessRequests))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleAction(id, action) {
    setBusy(id);
    setMsg(null);
    try {
      let res;
      if (action === "grant") {
        const hrs  = Number(expiry[id] || 0);
        const exp  = hrs > 0 ? Math.floor(Date.now() / 1000) + hrs * 3600 : 0;
        res = await access.grant(id, { expiryTimestamp: exp });
      } else if (action === "deny") {
        res = await access.deny(id);
      } else if (action === "revoke") {
        res = await access.revoke(id);
      }
      setReqs(prev => prev.map(r => r.requestId === id ? { ...r, status: res.data.accessRequest.status } : r));
      setMsg({ type: "success", text: `Access ${action}d successfully.` });
    } catch (err) {
      setMsg({ type: "danger", text: err.response?.data?.error || `Failed to ${action}` });
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div>
      {msg && <Alert type={msg.type} message={msg.text} onDismiss={() => setMsg(null)} />}
      {!reqs.length ? (
        <div className="empty-state">
          <i className="bi bi-inbox"></i>
          <h6>No access requests</h6>
          <p className="small">When hospitals request access to your records, they appear here.</p>
        </div>
      ) : (
        <div className="table-card">
          <div className="table-header"><h6 className="mb-0 fw-bold">Access Requests ({reqs.length})</h6></div>
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr><th>Hospital</th><th>Doctor</th><th>Record</th><th>Scope</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {reqs.map(r => (
                  <tr key={r._id}>
                    <td className="small">{r.requestingHospitalId?.name || "—"}</td>
                    <td className="small">{r.requestingDoctorId?.name || "—"}</td>
                    <td><span className="hash-text">{r.recordId?.slice(0, 8)}…</span></td>
                    <td><span className="badge bg-secondary-subtle text-secondary">{r.requestedScope}</span></td>
                    <td><StatusBadge status={r.status} /></td>
                    <td>
                      {r.status === "pending" && (
                        <div className="d-flex align-items-center gap-1 flex-wrap">
                          <input
                            type="number" className="form-control form-control-sm" style={{ width: 70 }}
                            placeholder="hrs" min={0}
                            value={expiry[r.requestId] || ""}
                            onChange={e => setExpiry(p => ({ ...p, [r.requestId]: e.target.value }))}
                            title="Expiry in hours (0 = no expiry)"
                          />
                          <button className="btn btn-sm btn-success" disabled={busy === r.requestId}
                            onClick={() => handleAction(r.requestId, "grant")}>Grant</button>
                          <button className="btn btn-sm btn-danger" disabled={busy === r.requestId}
                            onClick={() => handleAction(r.requestId, "deny")}>Deny</button>
                        </div>
                      )}
                      {r.status === "granted" && (
                        <button className="btn btn-sm btn-warning" disabled={busy === r.requestId}
                          onClick={() => handleAction(r.requestId, "revoke")}>Revoke</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="mt-3 p-3 bg-warning-subtle border border-warning rounded-2 small text-muted">
        <i className="bi bi-exclamation-triangle me-2"></i>
        <strong>Revocation note:</strong> Revoking access prevents future retrieval through this system.
        It cannot erase copies previously downloaded by an authorized recipient.
      </div>
    </div>
  );
}

// ── Main Patient Dashboard ────────────────────────────────────
export default function PatientDashboard() {
  const { user } = useAuth();
  return (
    <Layout title="Patient Dashboard" subtitle={`Welcome, ${user?.name}`}>
      <Routes>
        <Route index    element={<Overview user={user} />} />
        <Route path="records"  element={<MyRecords />} />
        <Route path="requests" element={<AccessRequests />} />
        <Route path="sharing"  element={<div className="empty-state"><i className="bi bi-share"></i><h6>Sharing History</h6><p className="small">All past grants and revocations are shown in the Audit Log.</p><a href="/audit" className="btn btn-outline-primary btn-sm">Open Audit Log</a></div>} />
      </Routes>
    </Layout>
  );
}
