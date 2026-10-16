import { renderPortfolio } from '../utils/portfolioContent';

export function PreviewPanel({ data }) {
  const previewUrl = data.fullName.trim()
    ? `${data.fullName.trim().toLowerCase().replace(/\s+/g, '')}.dev`
    : 'portfolio-preview';

  const hasContent =
    data.fullName ||
    data.jobTitle ||
    data.bio ||
    data.experiences.some((entry) => entry.role || entry.company) ||
    data.education.some((entry) => entry.degree || entry.institution) ||
    data.projects.some((entry) => entry.title) ||
    data.skills.length > 0;

  return (
    <div className="preview-panel">
      <div className="preview-toolbar">
        <div className="preview-dots">
          <span className="dot-red" />
          <span className="dot-yellow" />
          <span className="dot-green" />
        </div>
        <span className="preview-url">{previewUrl}</span>
        <span className="preview-label">Live Preview</span>
      </div>
      <div className="preview-frame">
        {hasContent ? (
          renderPortfolio(data)
        ) : (
          <div className="preview-placeholder">
            <div className="placeholder-anim">
              <div className="ph-ring" />
              <div className="ph-ring ph-ring-2" />
              <span className="ph-icon">✦</span>
            </div>
            <h3>Your portfolio will appear here</h3>
            <p>Start filling in your details on the left to see a live preview.</p>
          </div>
        )}
      </div>
    </div>
  );
}
