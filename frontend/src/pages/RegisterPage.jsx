import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import Alert from "../components/Alert";

const ROLE_ROUTES = { patient: "/patient", doctor: "/doctor", hospitalAdmin: "/hospital" };

export default function RegisterPage() {
  const { register, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm]   = useState({ name: "", email: "", password: "", role: "patient", hospitalCode: "" });
  const [error, setError] = useState("");

  const needsHospital = form.role === "doctor" || form.role === "hospitalAdmin";

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (form.password.length < 8) { setError("Password must be at least 8 characters"); return; }
    const payload = { ...form };
    if (!needsHospital) delete payload.hospitalCode;
    const res = await register(payload);
    if (res.ok) {
      navigate(ROLE_ROUTES[form.role] || "/");
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light py-4">
      <div className="card shadow-sm" style={{ width: "100%", maxWidth: 480 }}>
        <div className="card-body p-4">
          <div className="text-center mb-4">
            <i className="bi bi-person-plus text-primary" style={{ fontSize: "2.5rem" }}></i>
            <h4 className="fw-bold mt-2">Create Account</h4>
            <p className="text-muted small">Healthcare Blockchain Platform</p>
          </div>

          <Alert type="danger" message={error} onDismiss={() => setError("")} />

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-3">
              <label className="form-label fw-semibold small">Full Name</label>
              <input type="text" className="form-control" value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Your full name" required />
            </div>
            <div className="mb-3">
              <label className="form-label fw-semibold small">Email</label>
              <input type="email" className="form-control" value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="you@example.com" required />
            </div>
            <div className="mb-3">
              <label className="form-label fw-semibold small">Password</label>
              <input type="password" className="form-control" value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder="Min 8 characters" required minLength={8} />
            </div>
            <div className="mb-3">
              <label className="form-label fw-semibold small">Role</label>
              <select className="form-select" value={form.role}
                onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                <option value="patient">Patient</option>
                <option value="doctor">Doctor</option>
                <option value="hospitalAdmin">Hospital Administrator</option>
              </select>
            </div>
            {needsHospital && (
              <div className="mb-3">
                <label className="form-label fw-semibold small">Hospital Code</label>
                <input type="text" className="form-control" value={form.hospitalCode}
                  onChange={e => setForm(p => ({ ...p, hospitalCode: e.target.value.toUpperCase() }))}
                  placeholder="e.g. HOSPITAL_A" required />
                <div className="form-text">Codes: HOSPITAL_A · HOSPITAL_B</div>
              </div>
            )}
            <button type="submit" className="btn btn-primary w-100" disabled={loading}>
              {loading ? <span className="spinner-border spinner-border-sm me-2" /> : null}
              {loading ? "Creating account…" : "Register"}
            </button>
          </form>

          <hr className="my-3" />
          <p className="text-center text-muted small mb-0">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
