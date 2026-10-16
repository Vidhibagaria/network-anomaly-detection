export function TopBar({ currentStep, totalSteps, isAiMode, onToggleMode }) {
  const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <div className="brand-logo">
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
              <rect x="2" y="2" width="22" height="22" rx="6" fill="url(#bg)" />
              <path d="M8 8h10v2H8zM8 12h7v2H8zM8 16h10v2H8z" fill="#fff" opacity=".85" />
              <defs>
                <linearGradient id="bg" x1="2" y1="2" x2="24" y2="24">
                  <stop stopColor="#818cf8" />
                  <stop offset="1" stopColor="#6366f1" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className="brand-name">Folio</span>
          <span className="brand-badge">Builder</span>
        </div>

        <div className="mode-toggle-container">
          <button
            className={`mode-toggle-btn ${!isAiMode ? 'active' : ''}`}
            onClick={() => onToggleMode(false)}
            type="button"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Manual
          </button>
          <button
            className={`mode-toggle-btn ${isAiMode ? 'active' : ''}`}
            onClick={() => onToggleMode(true)}
            type="button"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
            AI Assistant
          </button>
        </div>

        <div className="progress-wrapper">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="progress-text">
            Step {currentStep + 1} of {totalSteps}
          </span>
        </div>
      </div>
    </header>
  );
}


