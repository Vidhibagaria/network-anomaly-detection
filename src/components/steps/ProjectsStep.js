import { EntryListEditor } from '../EntryListEditor';
import { StepHeader } from '../StepHeader';

const config = [
  { key: 'title', label: 'Project Title', placeholder: 'e.g. Weather App' },
  {
    key: 'description',
    label: 'Description',
    placeholder: 'Brief description...',
    element: 'textarea',
  },
  {
    key: 'link',
    label: 'Project URL (optional)',
    placeholder: 'https://...',
    type: 'url',
  },
];

export function ProjectsStep({ projects, onAdd, onUpdate, onRemove }) {
  return (
    <div className="step-content active">
      <StepHeader
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            <path d="M12 11v6M9 14h6" />
          </svg>
        }
        title="Projects"
        description="Showcase your best work — up to 6 projects with descriptions and links."
      />
      <EntryListEditor
        items={projects}
        config={config}
        itemLabel="Project"
        onUpdate={onUpdate}
        onRemove={onRemove}
      />
      <button className="btn-add" type="button" onClick={onAdd}>
        <span className="btn-add-icon">+</span> Add Project
      </button>
    </div>
  );
}
