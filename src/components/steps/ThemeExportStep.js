import { FormCard } from '../FormCard';
import { StepHeader } from '../StepHeader';
import { themes } from '../../data/themes';

export function ThemeExportStep({ selectedTheme, onThemeChange, onDownload }) {
  return (
    <div className="step-content active">
      <StepHeader
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 14.7255 3.09032 17.1962 4.85857 19C5.01438 19.1558 5.09228 19.2337 5.15053 19.3248C5.20173 19.4049 5.23932 19.4925 5.26189 19.5847C5.28753 19.6896 5.28753 19.8003 5.28753 20.0215V20.8284C5.28753 21.4753 5.8122 22 6.45912 22H12Z" />
            <circle cx="7.5" cy="10.5" r="1.5" />
            <circle cx="11.5" cy="7.5" r="1.5" />
            <circle cx="16.5" cy="9.5" r="1.5" />
            <circle cx="15.5" cy="14.5" r="1.5" />
          </svg>
        }
        title="Theme & Export"
        description="Choose a visual style for your portfolio, then download it."
      />
      <FormCard label="Choose Theme">
        <div className="theme-grid">
          {themes.map((theme) => (
            <button
              key={theme.id}
              type="button"
              className={`theme-card${selectedTheme === theme.id ? ' selected' : ''}`}
              onClick={() => onThemeChange(theme.id)}
            >
              <div className="theme-swatch">
                {theme.swatches.map((swatch) => (
                  <span key={swatch} style={{ background: swatch }} />
                ))}
              </div>
              <div className="theme-label">{theme.label}</div>
              <div className="theme-tag">{theme.tag}</div>
            </button>
          ))}
        </div>
      </FormCard>
      <div className="export-card" style={{ marginTop: '1.25rem' }}>
        <div className="export-illustration">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <rect
              x="8"
              y="8"
              width="48"
              height="48"
              rx="12"
              fill="rgba(129,140,248,0.08)"
              stroke="rgba(129,140,248,0.2)"
              strokeWidth="1.5"
            />
            <path
              d="M32 22v14m0 0l-5-5m5 5l5-5"
              stroke="#818cf8"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M22 42h20" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <h3>Export Your Portfolio</h3>
        <p>Download your portfolio as a single HTML file — ready to host anywhere.</p>
        <button className="btn btn-primary btn-large" type="button" onClick={onDownload}>
          ↓ Download HTML
        </button>
      </div>
    </div>
  );
}
