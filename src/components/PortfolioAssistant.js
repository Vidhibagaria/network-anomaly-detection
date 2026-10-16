import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

const STATIC_ROLES = {
  software_engineering: {
    name: 'Software Engineering',
    skills: ['JavaScript', 'Python', 'Java', 'C++', 'Data Structures', 'Algorithms', 'SQL', 'Git'],
    keywords: ['Object-Oriented Programming', 'API Design', 'System Design', 'Git', 'Agile', 'CI/CD'],
    suggestedProjects: ['E-Commerce Backend API', 'Distributed Task Scheduler', 'Real-time Chat App with WebSockets']
  },
  ai_ml: {
    name: 'AI/ML Engineering',
    skills: ['Python', 'TensorFlow', 'PyTorch', 'Scikit-Learn', 'NumPy', 'Pandas', 'SQL', 'Deep Learning'],
    keywords: ['Neural Networks', 'Model Optimization', 'Data Pipelines', 'NLP', 'Computer Vision', 'Supervised Learning'],
    suggestedProjects: ['Image Classification Pipeline', 'Sentiment Analysis Transformer', 'Predictive Analytics Dashboard']
  },
  frontend: {
    name: 'Frontend Development',
    skills: ['HTML5', 'CSS3', 'JavaScript', 'React', 'Vue', 'Tailwind CSS', 'TypeScript', 'Webpack'],
    keywords: ['Responsive Design', 'User Experience (UX)', 'Single Page Applications (SPA)', 'State Management', 'Web Accessibility'],
    suggestedProjects: ['Interactive Design System Showcase', 'SaaS Dashboard with Analytics', 'Custom Kanban Board App']
  },
  backend: {
    name: 'Backend Development',
    skills: ['Node.js', 'Express', 'Python', 'Django', 'PostgreSQL', 'MongoDB', 'Docker', 'Redis'],
    keywords: ['RESTful APIs', 'Database Indexing', 'Authentication (OAuth/JWT)', 'Microservices', 'Cloud Architecture'],
    suggestedProjects: ['Multi-tenant SaaS API', 'Serverless microservice architecture', 'Caching layer with Redis']
  },
  data_science: {
    name: 'Data Science',
    skills: ['Python', 'SQL', 'Statistics', 'Data Visualization', 'Machine Learning', 'R', 'Tableau'],
    keywords: ['A/B Testing', 'Statistical Inference', 'Data Visualization', 'Machine Learning', 'Big Data', 'ETL'],
    suggestedProjects: ['Customer Churn Prediction Model', 'Sales Dashboard & Forecasting', 'A/B Test Analysis Report']
  },
  product_management: {
    name: 'Product Management',
    skills: ['Agile', 'Scrum', 'Jira', 'Product Roadmap', 'User Stories', 'Analytics', 'Market Research'],
    keywords: ['Product Strategy', 'KPIs & Metrics', 'Stakeholder Management', 'User Empathy', 'Cross-functional Leadership'],
    suggestedProjects: ['Product Requirements Document (PRD)', 'Market Opportunity Analysis', 'Feature Prioritization Roadmap']
  },
  ui_ux: {
    name: 'UI/UX Design',
    skills: ['Figma', 'Adobe XD', 'Sketch', 'Wireframing', 'Prototyping', 'User Research', 'Design Systems'],
    keywords: ['Information Architecture', 'User Journeys', 'Heuristic Evaluation', 'Interaction Design', 'UI Design Patterns'],
    suggestedProjects: ['Mobile App Design & Prototype', 'E-commerce Checkout Redesign Case Study', 'Corporate Website Design System']
  }
};

export function PortfolioAssistant({ formData, updateField, addSkill, setFormData }) {
  // Read API Key directly from environment variable
  const apiKey = process.env.REACT_APP_GEMINI_API_KEY;

  const [messages, setMessages] = useState([
    {
      id: '1',
      sender: 'bot',
      text: 'Hi! I am your AI Recruiter and Portfolio Coach. To get started, please paste the text of your existing resume (and optionally mention your target job role or paste the Job Description!). I will extract all information and populate your portfolio instantly.',
      timestamp: new Date()
    }
  ]);
  const [userInput, setUserInput] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(10);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Helper to get Gemini generative model
  const getModel = () => {
    if (!apiKey) return null;
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      return genAI.getGenerativeModel({
        model: 'gemini-3-flash-preview',
        generationConfig: {
          responseMimeType: 'application/json',
        }
      });
    } catch (e) {
      console.error('Error initializing Gemini AI:', e);
      return null;
    }
  };

  // Parse Resume and JD using Gemini if available
  const parseRoleOrJD = async (input) => {
    const model = getModel();
    if (!model) {
      throw new Error('API_KEY_MISSING');
    }

    const prompt = `Analyze this resume text and target job role/JD: "${input}". 
    Extract all professional details and structure them into the following JSON format.
    IMPORTANT: Do not fabricate or hallucinate any information. If a detail (such as email, links, experiences, projects, or education) is not present in the input text, leave it empty or return an empty array. Do not make up mock/dummy values.
    
    {
      "roleName": "Target job title if explicitly found, otherwise empty",
      "skills": ["List of extracted technical skills found in the text"],
      "keywords": ["List of industry keywords found in the text"],
      "suggestedProjects": [],
      "experienceLevel": "Entry Level, Mid Level, or Senior Level",
      "extractedProfile": {
        "fullName": "Candidate full name if found, else empty",
        "email": "Candidate email if found, else empty",
        "github": "GitHub URL if found, else empty",
        "linkedin": "LinkedIn URL if found, else empty",
        "website": "Personal website URL if found, else empty",
        "bio": "A summary of the candidate's profile based strictly on the text, else empty",
        "education": [{"degree": "Degree", "institution": "Institution", "year": "Year", "details": "Details"}],
        "skills": ["List of all candidate skills found in the text"],
        "experiences": [{"role": "Role", "company": "Company", "duration": "Duration", "description": "Description"}],
        "projects": [{"title": "Title", "description": "Description", "link": "Link"}]
      }
    }`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = JSON.parse(text);

    if (parsed.extractedProfile) {
      const extractedProfile = parsed.extractedProfile;
      setFormData(prev => ({
        ...prev,
        fullName: extractedProfile.fullName || '',
        jobTitle: parsed.roleName || prev.jobTitle || '',
        bio: extractedProfile.bio || '',
        email: extractedProfile.email || '',
        github: extractedProfile.github || '',
        linkedin: extractedProfile.linkedin || '',
        website: extractedProfile.website || '',
        skills: extractedProfile.skills || [],
        experiences: extractedProfile.experiences || [],
        education: extractedProfile.education || [],
        projects: extractedProfile.projects || []
      }));
      updateField('jobTitle', parsed.roleName || '');
      return { roleName: parsed.roleName || '', extractedProfile };
    }

    throw new Error('PARSING_FAILED');
  };

  // Local Fallback Heuristics
  const parseLocalFallback = (input) => {
    const text = input.toLowerCase();
    let matchedKey = 'software_engineering';

    if (text.includes('machine learning') || text.includes('ai') || text.includes('ml') || text.includes('deep learning')) {
      matchedKey = 'ai_ml';
    } else if (text.includes('frontend') || text.includes('react') || text.includes('ui developer') || text.includes('css')) {
      matchedKey = 'frontend';
    } else if (text.includes('backend') || text.includes('api') || text.includes('node') || text.includes('database')) {
      matchedKey = 'backend';
    } else if (text.includes('data science') || text.includes('data scientist') || text.includes('statistics') || text.includes('analytics')) {
      matchedKey = 'data_science';
    } else if (text.includes('product manager') || text.includes('pm') || text.includes('product strategy')) {
      matchedKey = 'product_management';
    } else if (text.includes('designer') || text.includes('ui/ux') || text.includes('figma') || text.includes('ux')) {
      matchedKey = 'ui_ux';
    }

    const roleInfo = STATIC_ROLES[matchedKey];

    // Simple local regex extraction for fallback - STRICTLY NO DUMMY VALUES
    const emailMatch = input.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const nameMatch = input.match(/(?:my name is|i am|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);

    const fallbackProfile = {
      fullName: nameMatch?.[1] || '',
      email: emailMatch?.[0] || '',
      bio: '',
      skills: [],
      experiences: [],
      education: [],
      projects: []
    };

    setFormData(prev => ({
      ...prev,
      fullName: fallbackProfile.fullName,
      jobTitle: roleInfo.name,
      bio: fallbackProfile.bio,
      email: fallbackProfile.email,
      skills: fallbackProfile.skills,
      experiences: fallbackProfile.experiences,
      education: fallbackProfile.education,
      projects: fallbackProfile.projects
    }));

    updateField('jobTitle', roleInfo.name);
    return { roleName: roleInfo.name, extractedProfile: fallbackProfile };
  };

  // Recruiter intelligence to process answers and update profile fields
  const processAnswer = async (stepId, text) => {
    setIsLoading(true);
    let botResponse = '';

    if (stepId === 'target_role') {
      try {
        const { roleName } = await parseRoleOrJD(text);
        botResponse = `Amazing! I've parsed your resume for the **${roleName || 'SDE'}** role and populated your portfolio with your name, contact details, experiences, education, and projects! Review the live preview on the right. If everything looks good, you're ready to export!`;
        setCurrentStep(8);
        setProgress(100);
      } catch (err) {
        console.error('Error during LLM extraction:', err);
        if (err.message === 'API_KEY_MISSING') {
          botResponse = `⚠️ **Gemini API Key is missing!** I could only extract your contact info locally. To unlock full AI extraction for your experiences, skills, education, and projects, please click the **🔑 Config Key** button in the header and paste a Google Gemini API Key. Alternatively, you can fill in the fields manually.`;
        } else {
          botResponse = `⚠️ **AI Parsing failed.** There was an error communicating with Gemini or parsing the JSON response. Please check your API Key and connection, or fill in the details manually.`;
        }

        // Execute fallback so they at least get something
        parseLocalFallback(text);
      }
    } else {
      applyLocalFieldUpdates(stepId, text);
      botResponse = `Updated! Review the changes in the preview panel.`;
    }

    setMessages(prev => [
      ...prev,
      { id: Math.random().toString(), sender: 'bot', text: botResponse, timestamp: new Date() }
    ]);
    setIsLoading(false);
  };
  // Helper to parse input values locally into form state
  const applyLocalFieldUpdates = (stepId, text) => {
    if (text.toLowerCase() === 'skip' || text.toLowerCase() === 'none') return;

    switch (stepId) {
      case 'personal_info':
        updateField('fullName', text);
        updateField('bio', `Aspiring ${formData.jobTitle || 'Professional'} focused on building high-impact solutions.`);
        break;

      case 'contact_info':
        const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        const githubMatch = text.match(/(github\.com\/[a-zA-Z0-9_-]+)/i);
        const linkedinMatch = text.match(/(linkedin\.com\/in\/[a-zA-Z0-9_-]+)/i);
        const urlMatch = text.match(/(https?:\/\/[^\s]+)/g);

        if (emailMatch) updateField('email', emailMatch[0]);
        if (githubMatch) updateField('github', 'https://' + githubMatch[0]);
        if (linkedinMatch) updateField('linkedin', 'https://' + linkedinMatch[0]);
        if (urlMatch) {
          urlMatch.forEach(url => {
            if (!url.includes('github') && !url.includes('linkedin')) {
              updateField('website', url);
            }
          });
        }
        break;

      case 'education':
        const eduParts = text.split(/,|\n/);
        const degree = eduParts[0] || 'Bachelor\'s Degree';
        const inst = eduParts[1] || 'University';
        const year = eduParts[2] || '2026';

        setFormData(prev => ({
          ...prev,
          education: [{ degree: degree.trim(), institution: inst.trim(), year: year.trim(), details: 'Focus on core concepts.' }]
        }));
        break;

      case 'skills':
        const cleanSkills = text.split(/[,\n]/).map(s => s.trim()).filter(s => s.length > 1);
        setFormData(prev => ({
          ...prev,
          skills: cleanSkills
        }));
        break;

      case 'experience':
        const expLines = text.split('\n');
        const roleAndCompany = expLines[0] || 'Software Intern';
        const responsibilities = expLines.slice(1).join(' ') || 'Assisted in building responsive features and optimizing performance.';

        setFormData(prev => ({
          ...prev,
          experiences: [{
            role: roleAndCompany.split('at')[0]?.trim() || 'Software Developer Intern',
            company: roleAndCompany.split('at')[1]?.trim() || 'Tech Corp',
            duration: 'Summer 2025',
            description: `Engineered and developed core features. ${responsibilities}`
          }]
        }));
        break;

      case 'projects':
        const projTitle = text.split(/[:-]/)[0] || 'Portfolio Web App';
        const projDesc = text.split(/[:-]/).slice(1).join(' ') || 'An interactive showcase built with React.';

        setFormData(prev => ({
          ...prev,
          projects: [{
            title: projTitle.trim(),
            description: `Developed a dynamic, user-friendly ${projDesc.trim()}`,
            link: formData.github || 'https://github.com'
          }]
        }));
        break;

      default:
        break;
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!userInput.trim()) return;

    const userMsg = userInput;
    setMessages(prev => [...prev, { id: Math.random().toString(), sender: 'user', text: userMsg, timestamp: new Date() }]);
    setUserInput('');

    const stepId = currentStep === 0 ? 'target_role' : 'profile_update';
    processAnswer(stepId, userMsg);
  };

  const handleRestart = () => {
    setMessages([
      {
        id: '1',
        sender: 'bot',
        text: 'Hi! I am your AI Recruiter and Portfolio Coach. To get started, please paste the text of your existing resume (and optionally mention your target job role or paste the Job Description!). I will extract all information and populate your portfolio instantly.',
        timestamp: new Date()
      }
    ]);
    setCurrentStep(0);
    setProgress(10);
  };


  return (
    <div className="assistant-container">
      {/* Recruiter Profile Header & API Config */}
      <div className="assistant-header">
        <div className="assistant-avatar">🤖</div>
        <div className="assistant-meta">
          <h3>AI Recruiter Coach</h3>
          <p className="status-online">
            {apiKey ? '● Gemini Powered' : '● Local Assistant Mode'}
          </p>
        </div>

        <button className="btn btn-ghost btn-xs btn-restart" onClick={handleRestart}>
          🔄 Restart
        </button>
      </div>

      {/* Progress Bar */}
      <div className="interview-progress-container">
        <div className="interview-progress-bar">
          <div className="interview-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="interview-progress-text">Interview Completion: {progress}%</span>
      </div>

      {/* Chat Messages */}
      <div className="assistant-chat-window">
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-bubble-wrapper ${msg.sender}`}>
            <div className="chat-bubble">
              <p>{msg.text}</p>
              <span className="chat-timestamp">
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="chat-bubble-wrapper bot">
            <div className="chat-bubble loading">
              <span className="dot-pulse" />
              <span className="dot-pulse" />
              <span className="dot-pulse" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <form onSubmit={handleSend} className="assistant-input-form">
        <textarea
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder={
            currentStep === 0
              ? 'e.g., Frontend React Developer, or paste a Job Description...'
              : 'Type your response here...'
          }
          className="assistant-textarea"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend(e);
            }
          }}
        />
        <button type="submit" className="btn btn-primary btn-send">
          Send
        </button>
      </form>
    </div>
  );
}
