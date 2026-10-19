import { useState, useEffect } from "react";
import { Routes, Route, Link } from "react-router-dom";
import Layout from "../components/Layout";
import Spinner from "../components/Spinner";
import Alert from "../components/Alert";
import { useAuth } from "../hooks/useAuth";
import api, { records as recordsApi, access } from "../api/client";

// ── Overview ──────────────────────────────────────────────────
function Overview({ user }) {
  const [stats, setStats] = useState({ records: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    access.list()
      .then(res => setStats({ records: res.data.accessRequests.length }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="row g-3 mb-4">
        {[
          { label: "My Access Requests", value: stats.records, icon: "bi-arrow-left-right", color: "#0d6efd" },
          { label: "Hospital",           value: "Active",      icon: "bi-building",          color: "#198754" },
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
      <div className="row g-3">
        <div className="col-md-6">
          <div className="card h-100">
            <div className="card-body">
              <h6 className="fw-bold"><i className="bi bi-plus-circle me-2 text-primary"></i>Create Medical Record</h6>
              <p className="small text-muted">Create an encrypted, blockchain-anchored record for a patient.</p>
              <Link to="/doctor/new-record" className="btn btn-sm btn-primary">Create Record</Link>
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card h-100">
            <div className="card-body">
              <h6 className="fw-bold"><i className="bi bi-arrow-left-right me-2 text-success"></i>Request Record Access</h6>
              <p className="small text-muted">Request access to a patient's record held at another hospital.</p>
              <Link to="/doctor/requests" className="btn btn-sm btn-success">Request Access</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Create Record ─────────────────────────────────────────────
function CreateRecord() {
  const [form, setForm] = useState({
    patientId: "",
    recordType: "ENCOUNTER",
    recordCategory: "ENCOUNTER",
    encounterDate: "",
    content: {
      chiefComplaint: "", diagnosis: "", medications: "",
      allergies: "", observations: "", procedures: "", notes: "",
    },
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]         = useState(null);
  const [error, setError]           = useState("");
  const [patientList, setPatientList] = useState([]);

  useEffect(() => {
    api.get("/patients?role=patient")
      .then(r => setPatientList(r.data.users || []))
      .catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setResult(null);
    try {
      const res = await recordsApi.create(form);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create record");
    } finally {
      setSubmitting(false);
    }
  }

  const RECORD_TYPES = ["ENCOUNTER", "LAB", "PRESCRIPTION", "IMAGING", "PROCEDURE", "ALLERGY", "IMMUNIZATION"];

  return (
    <div className="form-card">
      <h5 className="fw-bold mb-4"><i className="bi bi-plus-circle me-2 text-primary"></i>Create Medical Record</h5>

      {result && (
        <div className="alert alert-success">
          <i className="bi bi-check-circle me-2"></i>
          <strong>Record created!</strong> ID: <code>{result.recordId}</code><br />
          <small>Hash: <code>{result.contentHash}</code></small><br />
          {result.blockchainTxHash && <small>Tx: <code>{result.blockchainTxHash}</code></small>}
        </div>
      )}
      <Alert type="danger" message={error} onDismiss={() => setError("")} />

      <form onSubmit={handleSubmit}>
        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label fw-semibold small">Patient</label>
            <select className="form-select" value={form.patientId}
              onChange={e => setForm(p => ({ ...p, patientId: e.target.value }))} required>
              <option value="">Select patient…</option>
              {patientList.map(p => (
                <option key={p._id} value={p._id}>{p.name} ({p.email})</option>
              ))}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label fw-semibold small">Record Type</label>
            <select className="form-select" value={form.recordType}
              onChange={e => setForm(p => ({ ...p, recordType: e.target.value, recordCategory: e.target.value }))}>
              {RECORD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label fw-semibold small">Encounter Date</label>
            <input type="date" className="form-control" value={form.encounterDate}
              onChange={e => setForm(p => ({ ...p, encounterDate: e.target.value }))} />
          </div>
          {Object.entries(form.content).map(([field, val]) => (
            <div className="col-md-6" key={field}>
              <label className="form-label fw-semibold small text-capitalize">
                {field.replace(/([A-Z])/g, " $1")}
              </label>
              <input type="text" className="form-control" value={val}
                onChange={e => setForm(p => ({ ...p, content: { ...p.content, [field]: e.target.value } }))}
                placeholder={`Enter ${field}…`} />
            </div>
          ))}
          <div className="col-12">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting
                ? <><span className="spinner-border spinner-border-sm me-2" />Creating &amp; encrypting…</>
                : "Create & Register on Blockchain"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ── Request Access ────────────────────────────────────────────
function RequestAccess() {
  const [form, setForm]         = useState({ recordId: "", requestedScope: "*", purpose: "" });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState("");
  const [myRequests, setMyRequests] = useState([]);

  useEffect(() => {
    access.list().then(r => setMyRequests(r.data.accessRequests || [])).catch(() => {});
  }, [result]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setResult(null);
    try {
      const res = await access.request(form);
      setResult(res.data);
      setForm({ recordId: "", requestedScope: "*", purpose: "" });
    } catch (err) {
      setError(err.response?.data?.error || "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  const SCOPES = ["*", "ENCOUNTER", "LAB", "PRESCRIPTION", "IMAGING"];

  return (
    <div>
      <div className="form-card mb-4">
        <h5 className="fw-bold mb-4"><i className="bi bi-arrow-left-right me-2 text-primary"></i>Request Record Access</h5>
        {result && (
          <div className="alert alert-success">
            <i className="bi bi-check-circle me-2"></i>
            Access request submitted. Waiting for patient consent.
          </div>
        )}
        <Alert type="danger" message={error} onDismiss={() => setError("")} />
        <form onSubmit={handleSubmit}>
          <div className="row g-3">
            <div className="col-md-8">
              <label className="form-label fw-semibold small">Record ID (UUID)</label>
              <input type="text" className="form-control" value={form.recordId}
                onChange={e => setForm(p => ({ ...p, recordId: e.target.value }))}
                placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000" required />
            </div>
            <div className="col-md-4">
              <label className="form-label fw-semibold small">Scope</label>
              <select className="form-select" value={form.requestedScope}
                onChange={e => setForm(p => ({ ...p, requestedScope: e.target.value }))}>
                {SCOPES.map(s => <option key={s} value={s}>{s === "*" ? "All records" : s}</option>)}
              </select>
            </div>
            <div className="col-12">
              <label className="form-label fw-semibold small">Purpose / Clinical Justification</label>
              <input type="text" className="form-control" value={form.purpose}
                onChange={e => setForm(p => ({ ...p, purpose: e.target.value }))}
                placeholder="Reason for access…" maxLength={500} />
            </div>
            <div className="col-12">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? <span className="spinner-border spinner-border-sm me-2" /> : null}
                Submit Request
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="table-card">
        <div className="table-header"><h6 className="mb-0 fw-bold">My Access Requests</h6></div>
        {!myRequests.length ? (
          <div className="p-4 text-center text-muted small">No requests yet.</div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr><th>Record ID</th><th>Scope</th><th>Status</th><th>Requested</th></tr>
              </thead>
              <tbody>
                {myRequests.map(r => (
                  <tr key={r._id}>
                    <td><span className="hash-text">{r.recordId?.slice(0, 12)}…</span></td>
                    <td>{r.requestedScope}</td>
                    <td><span className={`badge-status badge-${r.status}`}>{r.status}</span></td>
                    <td className="small text-muted">{new Date(r.requestedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function DoctorDashboard() {
  const { user } = useAuth();
  return (
    <Layout title="Doctor Dashboard" subtitle={`${user?.name} — Doctor`}>
      <Routes>
        <Route index          element={<Overview user={user} />} />
        <Route path="new-record" element={<CreateRecord />} />
        <Route path="requests"   element={<RequestAccess />} />
        <Route path="records"    element={
          <div className="empty-state">
            <i className="bi bi-file-medical"></i>
            <h6>Records</h6>
            <p className="small">Use the search to look up a patient record by ID.</p>
          </div>
        } />
        <Route path="patients"   element={
          <div className="empty-state">
            <i className="bi bi-people"></i>
            <h6>Patients</h6>
            <p className="small">Patient lookup feature coming soon.</p>
          </div>
        } />
      </Routes>
    </Layout>
  );
}
