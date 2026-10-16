function validEntries(items, keys) {
  return items.filter((item) => keys.some((key) => item[key]));
}

export function renderPortfolio(data) {
  const experienceItems = validEntries(data.experiences, ['role', 'company']);
  const educationItems = validEntries(data.education, ['degree', 'institution']);
  const projectItems = validEntries(data.projects, ['title']);
  const links = [
    data.github ? { href: data.github, label: 'GitHub' } : null,
    data.linkedin ? { href: data.linkedin, label: 'LinkedIn' } : null,
    data.twitter ? { href: data.twitter, label: 'Twitter' } : null,
    data.website ? { href: data.website, label: 'Website' } : null,
    data.email ? { href: `mailto:${data.email}`, label: 'Email' } : null,
  ].filter(Boolean);

  return (
    <div className={`pf theme-${data.selectedTheme}`}>
      <div className="pf-hero">
        {data.profileImage ? (
          <img className="pf-hero-img" src={data.profileImage} alt={data.fullName || 'Profile'} />
        ) : null}
        <h1>{data.fullName || 'Your Name'}</h1>
        <p className="pf-title">{data.jobTitle || 'Your Title'}</p>
        {data.bio ? <p className="pf-bio">{data.bio}</p> : null}
        {links.length ? (
          <div className="pf-links">
            {links.map((link) => (
              <a key={link.label} href={link.href} target="_blank" rel="noreferrer">
                {link.label}
              </a>
            ))}
          </div>
        ) : null}
      </div>

      {experienceItems.length ? (
        <Section
          title="Experience"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          }
        >
          <Timeline
            items={experienceItems}
            titleKey="role"
            subtitleKey="company"
            metaKey="duration"
            descriptionKey="description"
            fallbackTitle="Role"
          />
        </Section>
      ) : null}

      {educationItems.length ? (
        <Section
          title="Education"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
              <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
            </svg>
          }
        >
          <Timeline
            items={educationItems}
            titleKey="degree"
            subtitleKey="institution"
            metaKey="year"
            descriptionKey="details"
            fallbackTitle="Degree"
          />
        </Section>
      ) : null}

      {projectItems.length ? (
        <Section
          title="Projects"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              <path d="M12 11v6M9 14h6" />
            </svg>
          }
        >
          <div className="pf-projects-grid">
            {projectItems.map((project, index) => (
              <div className="pf-project-card" key={`${project.title || 'project'}-${index}`}>
                <h3>{project.title || 'Project'}</h3>
                <p>{project.description}</p>
                {project.link ? (
                  <a className="pf-project-link" href={project.link} target="_blank" rel="noreferrer">
                    View →
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {data.skills.length ? (
        <Section
          title="Skills"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          }
        >
          <div className="pf-skills-cloud">
            {data.skills.map((skill, index) => (
              <span className="pf-skill" key={`${skill}-${index}`}>
                {skill}
              </span>
            ))}
          </div>
        </Section>
      ) : null}

      {data.email ? (
        <div className="pf-contact">
          <h2>Get in Touch</h2>
          <p>I'd love to hear from you — let's build something great together.</p>
          <a className="pf-email-btn" href={`mailto:${data.email}`}>
            {data.email}
          </a>
        </div>
      ) : null}

      <div className="pf-footer">Built with Folio</div>
    </div>
  );
}

function Section({ title, icon, children }) {
  return (
    <div className="pf-section">
      <div className="pf-section-title">
        <span className="pf-sec-icon">{icon}</span> {title}
      </div>
      {children}
    </div>
  );
}

function Timeline({ items, titleKey, subtitleKey, metaKey, descriptionKey, fallbackTitle }) {
  return (
    <div className="pf-timeline">
      {items.map((item, index) => (
        <div className="pf-timeline-item" key={`${item[titleKey] || fallbackTitle}-${index}`}>
          <h4>{item[titleKey] || fallbackTitle}</h4>
          <div className="pf-sub">{item[subtitleKey]}</div>
          {item[metaKey] ? <div className="pf-date">{item[metaKey]}</div> : null}
          {item[descriptionKey] ? <div className="pf-desc">{item[descriptionKey]}</div> : null}
        </div>
      ))}
    </div>
  );
}
