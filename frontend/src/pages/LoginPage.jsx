import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import Alert from "../components/Alert";

export default function LoginPage() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm]   = useState({ email: "", password: "" });
  const [error, setError] = useState("");

  const ROLE_ROUTES = { patient: "/patient", doctor: "/doctor", hospitalAdmin: "/hospital", sysAdmin: "/admin" };

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const res = await login(form.email, form.password);
    if (res.ok) {
      const user = JSON.parse(localStorage.getItem("hc_user"));
      navigate(ROLE_ROUTES[user.role] || "/");
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
      <div className="card shadow-sm" style={{ width: "100%", maxWidth: 440 }}>
        <div className="card-body p-4">
          <div className="text-center mb-4">
            <i className="bi bi-hospital text-primary" style={{ fontSize: "2.5rem" }}></i>
            <h4 className="fw-bold mt-2">Sign In</h4>
            <p className="text-muted small">Healthcare Blockchain Platform</p>
          </div>

          <Alert type="danger" message={error} onDismiss={() => setError("")} />

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-3">
              <label className="form-label fw-semibold small">Email address</label>
              <input
                type="email" className="form-control"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="you@example.com" required autoComplete="email"
              />
            </div>
            <div className="mb-4">
              <label className="form-label fw-semibold small">Password</label>
              <input
                type="password" className="form-control"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder="••••••••" required autoComplete="current-password"
              />
            </div>
            <button type="submit" className="btn btn-primary w-100" disabled={loading}>
              {loading ? <span className="spinner-border spinner-border-sm me-2" /> : null}
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <hr className="my-3" />
          <p className="text-center text-muted small mb-0">
            No account? <Link to="/register">Register</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
