import { EntryListEditor } from '../EntryListEditor';
import { StepHeader } from '../StepHeader';

const config = [
  { key: 'degree', label: 'Degree / Certification', placeholder: 'e.g. B.S. Computer Science' },
  {
    type: 'row',
    fields: [
      { key: 'institution', label: 'Institution', placeholder: 'e.g. MIT' },
      { key: 'year', label: 'Year', placeholder: 'e.g. 2020 — 2024' },
    ],
  },
  {
    key: 'details',
    label: 'Details (optional)',
    placeholder: 'Any honors, GPA, or details...',
    element: 'textarea',
  },
];

export function EducationStep({ education, onAdd, onUpdate, onRemove }) {
  return (
    <div className="step-content active">
      <StepHeader
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
            <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
          </svg>
        }
        title="Education"
        description="List your degrees, certifications, and educational background."
      />
      <EntryListEditor
        items={education}
        config={config}
        itemLabel="Education"
        onUpdate={onUpdate}
        onRemove={onRemove}
      />
      <button className="btn-add" type="button" onClick={onAdd}>
        <span className="btn-add-icon">+</span> Add Education
      </button>
    </div>
  );
}
