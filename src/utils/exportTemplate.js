import { exportStyles } from './exportStyles';

function validEntries(items, keys) {
  return items.filter((item) => keys.some((key) => item[key]));
}

export function buildExportDocument(data) {
  const name = escapeHtml(data.fullName || 'Your Name');
  const title = escapeHtml(data.jobTitle || 'Your Title');
  const bio = data.bio ? `<p class="pf-bio">${escapeHtml(data.bio)}</p>` : '';
  const profileImage = data.profileImage
    ? `<img class="pf-hero-img" src="${escapeAttribute(data.profileImage)}" alt="${name}">`
    : '';
  const links = [
    data.github ? `<a href="${escapeAttribute(data.github)}" target="_blank" rel="noreferrer">GitHub</a>` : '',
    data.linkedin ? `<a href="${escapeAttribute(data.linkedin)}" target="_blank" rel="noreferrer">LinkedIn</a>` : '',
    data.twitter ? `<a href="${escapeAttribute(data.twitter)}" target="_blank" rel="noreferrer">Twitter</a>` : '',
    data.website ? `<a href="${escapeAttribute(data.website)}" target="_blank" rel="noreferrer">Website</a>` : '',
    data.email ? `<a href="mailto:${escapeAttribute(data.email)}">Email</a>` : '',
  ]
    .filter(Boolean)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name} - Portfolio</title>
  <meta name="description" content="Portfolio of ${name} - ${escapeHtml(data.jobTitle || '')}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>${exportStyles}</style>
</head>
<body class="theme-${escapeAttribute(data.selectedTheme)}">
  <div class="pf">
    <div class="pf-hero">
      ${profileImage}
      <h1>${name}</h1>
      <p class="pf-title">${title}</p>
      ${bio}
      ${links ? `<div class="pf-links">${links}</div>` : ''}
    </div>
    ${buildTimelineSection('Experience', '💼', validEntries(data.experiences, ['role', 'company']), 'role', 'company', 'duration', 'description', 'Role')}
    ${buildTimelineSection('Education', '🎓', validEntries(data.education, ['degree', 'institution']), 'degree', 'institution', 'year', 'details', 'Degree')}
    ${buildProjectsSection(validEntries(data.projects, ['title']))}
    ${buildSkillsSection(data.skills)}
    ${buildContactSection(data.email)}
    <div class="pf-footer">Built with Folio</div>
  </div>
</body>
</html>`;
}

function buildTimelineSection(title, icon, items, titleKey, subtitleKey, metaKey, descriptionKey, fallback) {
  if (!items.length) {
    return '';
  }

  const content = items
    .map(
      (item) => `
      <div class="pf-timeline-item">
        <h4>${escapeHtml(item[titleKey] || fallback)}</h4>
        <div class="pf-sub">${escapeHtml(item[subtitleKey] || '')}</div>
        ${item[metaKey] ? `<div class="pf-date">${escapeHtml(item[metaKey])}</div>` : ''}
        ${item[descriptionKey] ? `<div class="pf-desc">${escapeHtml(item[descriptionKey])}</div>` : ''}
      </div>`
    )
    .join('');

  return `
    <div class="pf-section">
      <div class="pf-section-title"><span class="pf-sec-icon">${icon}</span> ${title}</div>
      <div class="pf-timeline">${content}</div>
    </div>`;
}

function buildProjectsSection(projects) {
  if (!projects.length) {
    return '';
  }

  const content = projects
    .map(
      (project) => `
      <div class="pf-project-card">
        <h3>${escapeHtml(project.title || 'Project')}</h3>
        <p>${escapeHtml(project.description || '')}</p>
        ${project.link ? `<a class="pf-project-link" href="${escapeAttribute(project.link)}" target="_blank" rel="noreferrer">View →</a>` : ''}
      </div>`
    )
    .join('');

  return `
    <div class="pf-section">
      <div class="pf-section-title"><span class="pf-sec-icon">🚀</span> Projects</div>
      <div class="pf-projects-grid">${content}</div>
    </div>`;
}

function buildSkillsSection(skills) {
  if (!skills.length) {
    return '';
  }

  return `
    <div class="pf-section">
      <div class="pf-section-title"><span class="pf-sec-icon">⚡</span> Skills</div>
      <div class="pf-skills-cloud">${skills
        .map((skill) => `<span class="pf-skill">${escapeHtml(skill)}</span>`)
        .join('')}</div>
    </div>`;
}

function buildContactSection(email) {
  if (!email) {
    return '';
  }

  return `
    <div class="pf-contact">
      <h2>Get in Touch</h2>
      <p>I'd love to hear from you — let's build something great together.</p>
      <a class="pf-email-btn" href="mailto:${escapeAttribute(email)}">${escapeHtml(email)}</a>
    </div>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
