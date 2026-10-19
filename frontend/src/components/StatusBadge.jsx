export default function StatusBadge({ status }) {
  const map = {
    pending:  "badge-pending",
    granted:  "badge-granted",
    denied:   "badge-denied",
    revoked:  "badge-revoked",
    active:   "badge-active",
    expired:  "badge-revoked",
  };
  return (
    <span className={`badge-status ${map[status] || "badge-revoked"}`}>
      {status}
    </span>
  );
}
