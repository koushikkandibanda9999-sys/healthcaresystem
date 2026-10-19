import { Link } from "react-router-dom";

const features = [
  { icon: "bi-shield-lock",     title: "Patient-Controlled Access",   desc: "Patients grant, deny, and revoke sharing permissions for each record." },
  { icon: "bi-file-earmark-lock", title: "AES-256-GCM Encryption",     desc: "Medical content is encrypted before storage. Keys never leave the backend service." },
  { icon: "bi-link-45deg",      title: "Blockchain Integrity",         desc: "SHA-256 content hashes anchored on a local EVM chain via smart contracts." },
  { icon: "bi-building",        title: "Inter-Hospital Exchange",      desc: "Hospital B doctors request access; smart contracts enforce consent and expiry." },
  { icon: "bi-graph-up",        title: "Performance Evaluation",       desc: "Repeatable benchmarks measure latency, throughput, gas cost, and error rates." },
  { icon: "bi-clock-history",   title: "Immutable Audit Trail",        desc: "Every access, grant, and revocation is logged for transparency." },
];

export default function LandingPage() {
  return (
    <div>
      <div className="landing-hero">
        <div className="container">
          <div className="d-flex justify-content-center mb-3">
            <span className="badge bg-primary bg-opacity-25 text-white px-3 py-2">
              Research Prototype · EVM + Solidity + React
            </span>
          </div>
          <h1 className="mb-3">Patient-Centric Permissioned<br />Blockchain Medical Record Exchange</h1>
          <p className="lead opacity-75 mb-4 mx-auto" style={{ maxWidth: 600 }}>
            A consent-controlled framework for verifiable inter-hospital medical
            record sharing. Patients own access decisions. Blockchain enforces them.
          </p>
          <div className="d-flex gap-3 justify-content-center flex-wrap">
            <Link to="/login"    className="btn btn-light btn-lg px-4">Sign In</Link>
            <Link to="/register" className="btn btn-outline-light btn-lg px-4">Register</Link>
          </div>
        </div>
      </div>

      <div className="container py-5">
        <h2 className="text-center mb-4 fw-bold">System Features</h2>
        <div className="row g-4">
          {features.map((f) => (
            <div className="col-md-6 col-lg-4" key={f.title}>
              <div className="feature-card">
                <i className={`bi ${f.icon} text-primary mb-2`} style={{ fontSize: "1.8rem" }}></i>
                <h6 className="fw-bold">{f.title}</h6>
                <p className="text-muted small mb-0">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 p-4 bg-warning-subtle border border-warning-subtle rounded-3">
          <h6 className="fw-bold"><i className="bi bi-exclamation-triangle me-2"></i>Research Prototype Disclaimer</h6>
          <p className="small mb-0 text-muted">
            This is a permissioned-style research prototype using a local EVM-compatible chain (Hardhat).
            It demonstrates the consent-controlled workflow using Solidity smart contracts and access-controlled
            accounts. This is NOT a production Hyperledger Fabric network. Synthetic demo data only.
            Do not use with real patient data.
          </p>
        </div>

        <div className="mt-4 p-4 bg-light rounded-3">
          <h6 className="fw-bold">Demo Accounts</h6>
          <div className="row g-2 small">
            {[
              ["Patient", "emma.wilson@patient.example", "Patient@2024!"],
              ["Doctor A (Hosp A)", "dr.johnson@hospitala.example", "DrJohnson@2024!"],
              ["Doctor B (Hosp B)", "dr.chen@hospitalb.example", "DrChen@2024!"],
              ["Hospital A Admin", "admin@hospitala.example", "HospA@dmin2024!"],
              ["System Admin", "sysadmin@healthcare.example", "SysAdmin@2024!"],
            ].map(([role, email, pw]) => (
              <div className="col-md-6" key={email}>
                <div className="d-flex gap-2">
                  <span className="badge bg-secondary">{role}</span>
                  <code className="text-muted">{email} / {pw}</code>
                </div>
              </div>
            ))}
          </div>
          <p className="text-muted small mt-2 mb-0">
            Run <code>cd backend && node src/utils/seed.js</code> to create these accounts.
          </p>
        </div>
      </div>
    </div>
  );
}
