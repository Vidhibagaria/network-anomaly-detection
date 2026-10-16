export function StepNavigation({
  currentStep,
  totalSteps,
  onPrev,
  onNext,
  onStepClick,
}) {
  return (
    <div className="step-nav">
      <button className="btn btn-ghost" type="button" onClick={onPrev} disabled={currentStep === 0}>
        ← Back
      </button>
      <div className="step-nav-indicators">
        {Array.from({ length: totalSteps }, (_, index) => {
          const className =
            index === currentStep ? 'nav-dot active' : index < currentStep ? 'nav-dot completed' : 'nav-dot';

          return (
            <button
              key={index}
              className={className}
              type="button"
              onClick={() => onStepClick(index)}
              aria-label={`Go to step ${index + 1}`}
            />
          );
        })}
      </div>
      {currentStep === totalSteps - 1 ? (
        <span />
      ) : (
        <button className="btn btn-primary" type="button" onClick={onNext}>
          Next →
        </button>
      )}
    </div>
  );
}

