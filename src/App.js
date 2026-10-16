import { useState } from 'react';
import './App.css';
import { PreviewPanel } from './components/PreviewPanel';
import { StepNavigation } from './components/StepNavigation';
import { TopBar } from './components/TopBar';
import { ContactLinksStep } from './components/steps/ContactLinksStep';
import { EducationStep } from './components/steps/EducationStep';
import { ExperienceStep } from './components/steps/ExperienceStep';
import { PersonalInfoStep } from './components/steps/PersonalInfoStep';
import { ProjectsStep } from './components/steps/ProjectsStep';
import { SkillsStep } from './components/steps/SkillsStep';
import { ThemeExportStep } from './components/steps/ThemeExportStep';
import { buildExportDocument } from './utils/exportTemplate';
import { PortfolioAssistant } from './components/PortfolioAssistant';

const TOTAL_STEPS = 7;

const initialState = {
  fullName: '',
  jobTitle: '',
  bio: '',
  email: '',
  github: '',
  linkedin: '',
  twitter: '',
  website: '',
  profileImage: '',
  selectedTheme: 'midnight',
  experiences: [],
  education: [],
  projects: [],
  skills: [],
};

function App() {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState(initialState);
  const [isAiMode, setIsAiMode] = useState(false);

  const updateField = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const addListItem = (field, item) => {
    setFormData((current) => ({
      ...current,
      [field]: [...current[field], item],
    }));
  };

  const updateListItem = (field, index, key, value) => {
    setFormData((current) => ({
      ...current,
      [field]: current[field].map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      ),
    }));
  };

  const removeListItem = (field, index) => {
    setFormData((current) => ({
      ...current,
      [field]: current[field].filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const addSkill = (skill) => {
    const nextSkill = skill.trim();
    if (!nextSkill || formData.skills.includes(nextSkill)) {
      return;
    }

    setFormData((current) => ({
      ...current,
      skills: [...current.skills, nextSkill],
    }));
  };

  const downloadPortfolio = () => {
    const html = buildExportDocument(formData);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const slug =
      formData.fullName.trim().toLowerCase().replace(/\s+/g, '-') || 'portfolio';

    anchor.href = url;
    anchor.download = `${slug}-portfolio.html`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const goToStep = (step) => {
    if (step >= 0 && step < TOTAL_STEPS) {
      setCurrentStep(step);
    }
  };

  const steps = [
    <PersonalInfoStep key="personal" formData={formData} updateField={updateField} />,
    <ContactLinksStep key="contact" formData={formData} updateField={updateField} />,
    <ExperienceStep
      key="experience"
      experiences={formData.experiences}
      onAdd={() =>
        addListItem('experiences', {
          role: '',
          company: '',
          duration: '',
          description: '',
        })
      }
      onUpdate={(index, key, value) => updateListItem('experiences', index, key, value)}
      onRemove={(index) => removeListItem('experiences', index)}
    />,
    <EducationStep
      key="education"
      education={formData.education}
      onAdd={() =>
        addListItem('education', {
          degree: '',
          institution: '',
          year: '',
          details: '',
        })
      }
      onUpdate={(index, key, value) => updateListItem('education', index, key, value)}
      onRemove={(index) => removeListItem('education', index)}
    />,
    <ProjectsStep
      key="projects"
      projects={formData.projects}
      onAdd={() => {
        if (formData.projects.length < 6) {
          addListItem('projects', {
            title: '',
            description: '',
            link: '',
          });
        }
      }}
      onUpdate={(index, key, value) => updateListItem('projects', index, key, value)}
      onRemove={(index) => removeListItem('projects', index)}
    />,
    <SkillsStep
      key="skills"
      skills={formData.skills}
      onAddSkill={addSkill}
      onRemoveSkill={(index) => removeListItem('skills', index)}
    />,
    <ThemeExportStep
      key="themes"
      selectedTheme={formData.selectedTheme}
      onThemeChange={(theme) => updateField('selectedTheme', theme)}
      onDownload={downloadPortfolio}
    />,
  ];

  return (
    <>
      <TopBar
        currentStep={currentStep}
        totalSteps={TOTAL_STEPS}
        isAiMode={isAiMode}
        onToggleMode={setIsAiMode}
      />
      <div className="app-layout">
        <div className="editor-panel">
          {isAiMode ? (
            <PortfolioAssistant
              formData={formData}
              updateField={updateField}
              addSkill={addSkill}
              setFormData={setFormData}
            />
          ) : (
            <>
              {steps[currentStep]}
              <StepNavigation
                currentStep={currentStep}
                totalSteps={TOTAL_STEPS}
                onPrev={() => goToStep(currentStep - 1)}
                onNext={() => goToStep(currentStep + 1)}
                onStepClick={goToStep}
              />
            </>
          )}
        </div>
        <PreviewPanel data={formData} />
      </div>
    </>
  );
}

export default App;
