import Sidebar from "./Sidebar";
import { useAuth } from "../hooks/useAuth";

export default function Layout({ children, title, subtitle }) {
  const { user } = useAuth();

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <header className="topbar">
          <div>
            {title && <h5 className="mb-0 fw-bold">{title}</h5>}
            {subtitle && <small className="text-muted">{subtitle}</small>}
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="badge bg-primary-subtle text-primary">
              <i className="bi bi-shield-check me-1"></i>
              {user?.role}
            </span>
            <span className="text-muted small">{user?.email}</span>
          </div>
        </header>
        <main className="page-container">
          {children}
        </main>
      </div>
    </div>
  );
}
