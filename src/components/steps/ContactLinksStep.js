import { FormCard } from '../FormCard';
import { StepHeader } from '../StepHeader';

export function ContactLinksStep({ formData, updateField }) {
  return (
    <div className="step-content active">
      <StepHeader
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        }
        title="Contact & Links"
        description="How can people reach you? Add your social profiles and contact info."
      />
      <FormCard label="Contact">
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={formData.email}
            onChange={(event) => updateField('email', event.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Website URL</label>
          <input
            type="url"
            placeholder="https://yoursite.com"
            value={formData.website}
            onChange={(event) => updateField('website', event.target.value)}
          />
        </div>
      </FormCard>
      <FormCard label="Social Profiles">
        <div className="form-row">
          <div className="form-group">
            <label>GitHub</label>
            <input
              type="url"
              placeholder="https://github.com/you"
              value={formData.github}
              onChange={(event) => updateField('github', event.target.value)}
            />
          </div>
          <div className="form-group">
            <label>LinkedIn</label>
            <input
              type="url"
              placeholder="https://linkedin.com/in/you"
              value={formData.linkedin}
              onChange={(event) => updateField('linkedin', event.target.value)}
            />
          </div>
        </div>
        <div className="form-group">
          <label>Twitter / X</label>
          <input
            type="url"
            placeholder="https://twitter.com/you"
            value={formData.twitter}
            onChange={(event) => updateField('twitter', event.target.value)}
          />
        </div>
      </FormCard>
    </div>
  );
}
