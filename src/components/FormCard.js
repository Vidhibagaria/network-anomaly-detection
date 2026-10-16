export function FormCard({ label, children }) {
  return (
    <div className="card">
      <div className="card-section">
        <div className="card-section-label">{label}</div>
        {children}
      </div>
    </div>
  );
}

