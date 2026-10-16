export function StepHeader({ icon, title, description }) {
  return (
    <div className="step-header">
      <span className="step-icon" aria-hidden="true">
        {icon}
      </span>
      <div>
        <h2 className="step-title">{title}</h2>
        <p className="step-desc">{description}</p>
      </div>
    </div>
  );
}

