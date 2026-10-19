export default function Alert({ type = "info", message, onDismiss }) {
  if (!message) return null;
  const icons = { success: "bi-check-circle", danger: "bi-x-circle", warning: "bi-exclamation-triangle", info: "bi-info-circle" };
  return (
    <div className={`alert alert-${type} d-flex align-items-center gap-2`} role="alert">
      <i className={`bi ${icons[type]}`}></i>
      <span>{message}</span>
      {onDismiss && (
        <button type="button" className="btn-close ms-auto" onClick={onDismiss} aria-label="Close" />
      )}
    </div>
  );
}
