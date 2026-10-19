import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const NAV_CONFIG = {
  patient: [
    { to: "/patient",          icon: "bi-house",          label: "Dashboard" },
    { to: "/patient/records",  icon: "bi-file-medical",   label: "My Records" },
    { to: "/patient/requests", icon: "bi-inbox",          label: "Access Requests" },
    { to: "/patient/sharing",  icon: "bi-share",          label: "Sharing History" },
    { to: "/audit",            icon: "bi-clock-history",  label: "Audit Log" },
  ],
  doctor: [
    { to: "/doctor",           icon: "bi-house",          label: "Dashboard" },
    { to: "/doctor/patients",  icon: "bi-people",         label: "My Patients" },
    { to: "/doctor/records",   icon: "bi-file-medical",   label: "Records" },
    { to: "/doctor/new-record",icon: "bi-plus-circle",    label: "Create Record" },
    { to: "/doctor/requests",  icon: "bi-arrow-left-right", label: "Request Access" },
  ],
  hospitalAdmin: [
    { to: "/hospital",          icon: "bi-house",         label: "Dashboard" },
    { to: "/hospital/records",  icon: "bi-file-medical",  label: "Hospital Records" },
    { to: "/hospital/doctors",  icon: "bi-person-badge",  label: "Doctors" },
    { to: "/hospital/requests", icon: "bi-arrow-left-right", label: "Access Requests" },
    { to: "/audit",             icon: "bi-clock-history", label: "Audit Log" },
  ],
  sysAdmin: [
    { to: "/admin",            icon: "bi-house",          label: "Dashboard" },
    { to: "/admin/hospitals",  icon: "bi-building",       label: "Hospitals" },
    { to: "/admin/users",      icon: "bi-people",         label: "Users" },
    { to: "/audit",            icon: "bi-clock-history",  label: "Audit Log" },
    { to: "/performance",      icon: "bi-graph-up",       label: "Performance" },
  ],
};

const ROLE_LABELS = {
  patient:      "Patient",
  doctor:       "Doctor",
  hospitalAdmin: "Hospital Admin",
  sysAdmin:     "System Admin",
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const navItems = NAV_CONFIG[user?.role] || [];

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <i className="bi bi-hospital text-primary me-2"></i>
        <h6>Healthcare Blockchain</h6>
        <small>{ROLE_LABELS[user?.role] || "User"} · {user?.name?.split(" ")[0]}</small>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-title">Navigation</div>
        {navItems.map((item) => (
          <div className="nav-item" key={item.to}>
            <NavLink to={item.to} end={item.to.split("/").length <= 2}>
              <i className={`bi ${item.icon}`}></i>
              {item.label}
            </NavLink>
          </div>
        ))}

        <div className="nav-section-title mt-3">Account</div>
        <div className="nav-item">
          <button onClick={handleLogout}>
            <i className="bi bi-box-arrow-left"></i>
            Logout
          </button>
        </div>
      </nav>

      <div className="p-3 mt-auto" style={{ fontSize: "0.7rem", color: "rgba(160,174,192,0.5)", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <div>Research Prototype</div>
        <div>EVM + Solidity + Hardhat</div>
      </div>
    </aside>
  );
}
