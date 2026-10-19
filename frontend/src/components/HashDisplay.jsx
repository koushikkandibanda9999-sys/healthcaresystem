export default function HashDisplay({ hash, label }) {
  return (
    <div className="mb-2">
      {label && <small className="text-muted d-block mb-1">{label}</small>}
      <span className="hash-text">{hash || "—"}</span>
    </div>
  );
}
