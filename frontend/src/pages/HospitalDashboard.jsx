import { useState, useEffect } from "react";
import { Routes, Route, Link } from "react-router-dom";
import Layout from "../components/Layout";
import Spinner from "../components/Spinner";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../hooks/useAuth";
import { hospitals, access, auditApi } from "../api/client";

function Overview({ user }) {
  const [myHospital, setMyHospital] = useState(null);
  const [requests, setRequests]     = useState([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    Promise.all([
      user.hospitalId ? hospitals.get(user.hospitalId) : Promise.resolve(null),
      access.list(),
    ]).then(([hRes, aRes]) => {
      if (hRes) setMyHospital(hRes.data.hospital);
      setRequests(aRes.data.accessRequests || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const pending = requests.filter(r => r.status === "pending").length;
  const granted = requests.filter(r => r.status === "granted").length;

  return (
    <div>
      <div className="row g-3 mb-4">
        {[
          { label: "Pending Requests", value: pending, icon: "bi-inbox",        color: "#ffc107" },
          { label: "Active Grants",    value: granted, icon: "bi-check-circle", color: "#198754" },
          { label: "Total Requests",   value: requests.length, icon: "bi-arrow-left-right", color: "#0d6efd" },
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

      {myHospital && (
        <div className="p-3 bg-primary-subtle rounded-3 mb-4">
          <h6 className="fw-bold mb-1"><i className="bi bi-building me-2"></i>{myHospital.name}</h6>
          <small className="text-muted">Code: {myHospital.code} | Blockchain: {myHospital.blockchainAddress || "Not registered"}</small>
        </div>
      )}

      <div className="table-card">
        <div className="table-header">
          <h6 className="mb-0 fw-bold">Recent Access Requests</h6>
          <Link to="/hospital/requests" className="btn btn-sm btn-outline-primary">View All</Link>
        </div>
        {!requests.length
          ? <div className="p-4 text-center text-muted small">No access requests.</div>
          : (
            <div className="table-responsive">
              <table className="table">
                <thead><tr><th>Record</th><th>Doctor</th><th>Scope</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                  {requests.slice(0, 10).map(r => (
                    <tr key={r._id}>
                      <td><span className="hash-text">{r.recordId?.slice(0,10)}…</span></td>
                      <td className="small">{r.requestingDoctorId?.name || "—"}</td>
                      <td><span className="badge bg-secondary-subtle text-secondary">{r.requestedScope}</span></td>
                      <td><StatusBadge status={r.status} /></td>
                      <td className="small text-muted">{new Date(r.requestedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </div>
    </div>
  );
}

export default function HospitalDashboard() {
  const { user } = useAuth();
  return (
    <Layout title="Hospital Dashboard" subtitle="Hospital Administrator">
      <Routes>
        <Route index element={<Overview user={user} />} />
        <Route path="records"  element={<div className="empty-state"><i className="bi bi-file-medical"></i><h6>Hospital Records</h6><p className="small">All records created at this hospital.</p></div>} />
        <Route path="doctors"  element={<div className="empty-state"><i className="bi bi-person-badge"></i><h6>Doctors</h6><p className="small">Manage hospital doctors.</p></div>} />
        <Route path="requests" element={<RequestsPanel />} />
      </Routes>
    </Layout>
  );
}

function RequestsPanel() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    access.list().then(r => setRequests(r.data.accessRequests || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="table-card">
      <div className="table-header"><h6 className="mb-0 fw-bold">Access Requests ({requests.length})</h6></div>
      {!requests.length
        ? <div className="p-4 text-center text-muted small">No requests.</div>
        : (
          <div className="table-responsive">
            <table className="table">
              <thead><tr><th>Record</th><th>Doctor</th><th>Patient</th><th>Scope</th><th>Status</th><th>Tx</th></tr></thead>
              <tbody>
                {requests.map(r => (
                  <tr key={r._id}>
                    <td><span className="hash-text">{r.recordId?.slice(0,12)}…</span></td>
                    <td className="small">{r.requestingDoctorId?.name || "—"}</td>
                    <td className="small">{r.patientId?.name || "—"}</td>
                    <td>{r.requestedScope}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td><span className="hash-text">{r.grantBlockchainTxHash?.slice(0,10) || "—"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    </div>
  );
}
