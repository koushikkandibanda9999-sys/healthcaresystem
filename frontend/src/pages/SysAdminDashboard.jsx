import { useState, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "../components/Layout";
import Spinner from "../components/Spinner";
import Alert from "../components/Alert";
import { hospitals } from "../api/client";
import api from "../api/client";

function Overview() {
  const [users, setUsers] = useState([]);
  const [hospList, setHospList] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([api.get("/patients"), hospitals.list()])
      .then(([uRes, hRes]) => {
        setUsers(uRes.data.users || []);
        setHospList(hRes.data.hospitals || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const byRole = users.reduce((acc, u) => { acc[u.role] = (acc[u.role] || 0) + 1; return acc; }, {});

  return (
    <div>
      <div className="row g-3 mb-4">
        {[
          { label: "Total Users",     value: users.length,            icon: "bi-people",    color: "#0d6efd" },
          { label: "Hospitals",       value: hospList.length,         icon: "bi-building",  color: "#198754" },
          { label: "Patients",        value: byRole.patient || 0,     icon: "bi-person",    color: "#6f42c1" },
          { label: "Doctors",         value: byRole.doctor || 0,      icon: "bi-person-badge", color: "#fd7e14" },
        ].map(s => (
          <div className="col-sm-3" key={s.label}>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: s.color + "20" }}>
                <i className={`bi ${s.icon}`} style={{ color: s.color }}></i>
              </div>
              <div><div className="fw-bold fs-4">{s.value}</div><div className="text-muted small">{s.label}</div></div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 bg-warning-subtle border border-warning rounded-2 mb-4">
        <i className="bi bi-shield-exclamation me-2"></i>
        <strong>Security Note:</strong> System administrators do not have access to decrypted patient medical content.
        Clinical data is accessible only to authorized doctors with valid consent.
      </div>

      <HospitalList hospList={hospList} />
    </div>
  );
}

function HospitalList({ hospList }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", blockchainAddress: "", contactEmail: "" });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);
  const [list, setList] = useState(hospList);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await hospitals.register(form);
      setList(p => [...p, res.data.hospital]);
      setMsg({ type: "success", text: `Hospital "${form.name}" registered.${res.data.blockchainTxHash ? " Tx: " + res.data.blockchainTxHash : ""}` });
      setForm({ name: "", code: "", blockchainAddress: "", contactEmail: "" });
      setShowForm(false);
    } catch (err) {
      setMsg({ type: "danger", text: err.response?.data?.error || "Registration failed" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="table-card">
      <div className="table-header">
        <h6 className="mb-0 fw-bold">Registered Hospitals</h6>
        <button className="btn btn-sm btn-primary" onClick={() => setShowForm(p => !p)}>
          <i className="bi bi-plus me-1"></i>Register Hospital
        </button>
      </div>
      {msg && <div className="p-3"><Alert type={msg.type} message={msg.text} onDismiss={() => setMsg(null)} /></div>}
      {showForm && (
        <div className="p-3 border-bottom bg-light">
          <form onSubmit={handleSubmit}>
            <div className="row g-2">
              <div className="col-md-4"><input className="form-control form-control-sm" placeholder="Hospital Name *" value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} required /></div>
              <div className="col-md-2"><input className="form-control form-control-sm" placeholder="Code * (e.g. HOSP_C)" value={form.code} onChange={e => setForm(p => ({...p, code: e.target.value.toUpperCase()}))} required /></div>
              <div className="col-md-3"><input className="form-control form-control-sm" placeholder="Blockchain Address (0x…)" value={form.blockchainAddress} onChange={e => setForm(p => ({...p, blockchainAddress: e.target.value}))} /></div>
              <div className="col-md-3"><input className="form-control form-control-sm" placeholder="Contact Email" value={form.contactEmail} onChange={e => setForm(p => ({...p, contactEmail: e.target.value}))} /></div>
              <div className="col-12">
                <button type="submit" className="btn btn-sm btn-success me-2" disabled={submitting}>
                  {submitting ? <span className="spinner-border spinner-border-sm me-1" /> : null}Register
                </button>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </div>
          </form>
        </div>
      )}
      <div className="table-responsive">
        <table className="table">
          <thead><tr><th>Name</th><th>Code</th><th>Blockchain Address</th><th>Status</th></tr></thead>
          <tbody>
            {list.length === 0
              ? <tr><td colSpan={4} className="text-center text-muted small p-4">No hospitals registered.</td></tr>
              : list.map(h => (
                <tr key={h._id}>
                  <td className="fw-semibold">{h.name}</td>
                  <td><code>{h.code}</code></td>
                  <td><span className="hash-text">{h.blockchainAddress || "—"}</span></td>
                  <td><span className={`badge-status ${h.isActive ? "badge-active" : "badge-revoked"}`}>{h.isActive ? "active" : "inactive"}</span></td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UserList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/patients").then(r => setUsers(r.data.users || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="table-card">
      <div className="table-header"><h6 className="mb-0 fw-bold">All Users ({users.length})</h6></div>
      <div className="table-responsive">
        <table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Hospital</th><th>Wallet</th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u._id}>
                <td className="fw-semibold">{u.name}</td>
                <td className="small text-muted">{u.email}</td>
                <td><span className="badge bg-secondary-subtle text-secondary">{u.role}</span></td>
                <td className="small">{u.hospitalId?.name || "—"}</td>
                <td><span className="hash-text">{u.walletAddress?.slice(0,12) || "—"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SysAdminDashboard() {
  return (
    <Layout title="System Administrator" subtitle="Platform management">
      <Routes>
        <Route index          element={<Overview />} />
        <Route path="hospitals" element={<div><HospitalList hospList={[]} /></div>} />
        <Route path="users"     element={<UserList />} />
      </Routes>
    </Layout>
  );
}
