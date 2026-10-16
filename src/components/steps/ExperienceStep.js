import { EntryListEditor } from '../EntryListEditor';
import { StepHeader } from '../StepHeader';

const config = [
  {
    type: 'row',
    fields: [
      { key: 'role', label: 'Role / Position', placeholder: 'e.g. Senior Developer' },
      { key: 'company', label: 'Company', placeholder: 'e.g. Google' },
    ],
  },
  { key: 'duration', label: 'Duration', placeholder: 'e.g. Jan 2022 — Present' },
  {
    key: 'description',
    label: 'Description (optional)',
    placeholder: 'What did you do?',
    element: 'textarea',
  },
];

export function ExperienceStep({ experiences, onAdd, onUpdate, onRemove }) {
  return (
    <div className="step-content active">
      <StepHeader
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
        }
        title="Experience"
        description="Add your work experience — roles, companies, and what you accomplished."
      />
      <EntryListEditor
        items={experiences}
        config={config}
        itemLabel="Experience"
        onUpdate={onUpdate}
        onRemove={onRemove}
      />
      <button className="btn-add" type="button" onClick={onAdd}>
        <span className="btn-add-icon">+</span> Add Experience
      </button>
    </div>
  );
}
