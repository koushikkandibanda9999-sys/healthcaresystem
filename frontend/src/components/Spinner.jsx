export default function Spinner({ text = "Loading..." }) {
  return (
    <div className="spinner-overlay">
      <div className="text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">{text}</span>
        </div>
        <p className="mt-2 text-muted small">{text}</p>
      </div>
    </div>
  );
}
