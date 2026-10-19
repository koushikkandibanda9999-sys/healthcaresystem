import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import Layout from "../components/Layout";
import Spinner from "../components/Spinner";
import Alert from "../components/Alert";
import HashDisplay from "../components/HashDisplay";
import { records as recordsApi } from "../api/client";

export default function RecordDetailPage() {
  const { id }        = useParams();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [verResult, setVerResult] = useState(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    recordsApi.get(id)
      .then(res => setData(res.data))
      .catch(err => setError(err.response?.data?.error || "Failed to load record"))
      .finally(() => setLoading(false));
  }, [id]);

  async function verify() {
    setVerifying(true);
    try {
      const res = await recordsApi.verify(id);
      setVerResult(res.data);
    } catch (err) {
      setVerResult({ error: err.response?.data?.error || "Verification failed" });
    } finally {
      setVerifying(false);
    }
  }

  if (loading) return <Layout title="Record Detail"><Spinner /></Layout>;
  if (error)   return <Layout title="Record Detail"><Alert type="danger" message={error} /></Layout>;

  const { record, decryptedContent, verification } = data;

  return (
    <Layout title="Medical Record Detail" subtitle={`Record ID: ${record.recordId}`}>
      <div className="row g-4">
        {/* Metadata */}
        <div className="col-md-5">
          <div className="form-card mb-3">
            <h6 className="fw-bold mb-3"><i className="bi bi-info-circle me-2 text-primary"></i>Record Metadata</h6>
            <dl className="row small mb-0">
              {[
                ["Record ID",    record.recordId],
                ["Type",         record.recordType],
                ["Category",     record.recordCategory],
                ["Hospital",     record.hospitalId?.name],
                ["Doctor",       record.doctorId?.name],
                ["Patient",      record.patientId?.name],
                ["Created",      new Date(record.createdAt).toLocaleString()],
                ["Encounter",    record.encounterDate ? new Date(record.encounterDate).toLocaleDateString() : "—"],
              ].map(([k, v]) => (
                <><dt className="col-5 text-muted">{k}</dt><dd className="col-7">{v || "—"}</dd></>
              ))}
            </dl>
          </div>

          <div className="form-card mb-3">
            <h6 className="fw-bold mb-3"><i className="bi bi-link-45deg me-2 text-success"></i>Blockchain Anchoring</h6>
            <HashDisplay label="Content Hash (SHA-256)" hash={record.contentHash} />
            <HashDisplay label="Transaction Hash" hash={record.blockchainTxHash} />
          </div>

          {/* Integrity Verification */}
          <div className="form-card">
            <h6 className="fw-bold mb-3"><i className="bi bi-shield-check me-2 text-warning"></i>Integrity Verification</h6>
            {verification && (
              <div className={`p-2 rounded mb-2 ${verification.verified ? "alert-verified" : "alert-unverified"}`}>
                <i className={`bi ${verification.verified ? "bi-check-circle" : "bi-x-circle"} me-2`}></i>
                {verification.verified ? "Verified — content matches registered hash" : "INTEGRITY CHECK FAILED"}
              </div>
            )}
            {verResult && (
              <div className={`p-2 rounded mb-2 ${verResult.overallVerified ? "alert-verified" : "alert-unverified"}`}>
                <strong>{verResult.error || verResult.message}</strong>
                {verResult.offChain && (
                  <div className="mt-1 small">
                    Off-chain hash match: {verResult.offChain.verified ? "✓" : "✗"}<br />
                    On-chain hash match: {verResult.onChainMatch === true ? "✓" : verResult.onChainMatch === false ? "✗" : "not checked"}
                  </div>
                )}
              </div>
            )}
            <button className="btn btn-sm btn-outline-warning" onClick={verify} disabled={verifying}>
              {verifying ? <span className="spinner-border spinner-border-sm me-2" /> : <i className="bi bi-shield-check me-2"></i>}
              Re-verify Integrity
            </button>
          </div>
        </div>

        {/* Clinical Content */}
        <div className="col-md-7">
          <div className="form-card">
            <h6 className="fw-bold mb-3"><i className="bi bi-file-medical me-2 text-primary"></i>Clinical Content</h6>
            {!decryptedContent ? (
              <div className="empty-state py-4">
                <i className="bi bi-lock"></i>
                <h6>Content not available</h6>
                <p className="small">You need authorization to view the decrypted clinical content.</p>
              </div>
            ) : (
              <div>
                {Object.entries(decryptedContent).filter(([k]) => !["recordId","patientId","hospitalId","doctorId","createdAt"].includes(k)).map(([k, v]) => (
                  v && <div key={k} className="mb-2">
                    <label className="form-label fw-semibold small text-capitalize mb-0">{k.replace(/([A-Z])/g, " $1")}</label>
                    <div className="form-control-plaintext text-dark small">{String(v)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
