export const exportStyles = `*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { font-family: 'Inter', system-ui, sans-serif; line-height: 1.6; min-height: 100vh; }
a { color: inherit; text-decoration: none; }
img { max-width: 100%; display: block; }
.pf-hero { padding: 5rem 2.5rem; text-align: center; }
.pf-hero-img { width: 120px; height: 120px; border-radius: 50%; object-fit: cover; margin: 0 auto 1.5rem auto; }
.pf-hero h1 { font-family: 'Space Grotesk', sans-serif; font-size: 2.8rem; font-weight: 700; margin-bottom: 0.4rem; letter-spacing: -0.02em; }
.pf-hero .pf-title { font-size: 1.2rem; opacity: 0.65; margin-bottom: 1rem; }
.pf-hero .pf-bio { font-size: 1rem; opacity: 0.55; max-width: 550px; margin: 0 auto 1.5rem auto; }
.pf-links { display: flex; gap: 0.6rem; justify-content: center; flex-wrap: wrap; }
.pf-links a { padding: 0.45rem 1.1rem; border-radius: 18px; font-size: 0.85rem; font-weight: 600; transition: all 0.2s; }
.pf-section { padding: 3rem 2.5rem; max-width: 800px; margin: 0 auto; }
.pf-section-title { font-family: 'Space Grotesk', sans-serif; font-size: 1.4rem; font-weight: 700; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem; }
.pf-timeline { position: relative; padding-left: 1.5rem; }
.pf-timeline::before { content: ''; position: absolute; left: 0; top: 4px; bottom: 4px; width: 2px; border-radius: 1px; }
.pf-timeline-item { position: relative; padding-bottom: 1.5rem; padding-left: 1rem; }
.pf-timeline-item:last-child { padding-bottom: 0; }
.pf-timeline-item::before { content: ''; position: absolute; left: -1.5rem; top: 6px; width: 10px; height: 10px; border-radius: 50%; border: 2px solid; }
.pf-timeline-item h4 { font-size: 1.05rem; font-weight: 700; margin-bottom: 0.15rem; }
.pf-timeline-item .pf-sub { font-size: 0.9rem; opacity: 0.65; }
.pf-timeline-item .pf-date { font-size: 0.8rem; opacity: 0.45; margin-top: 0.15rem; }
.pf-timeline-item .pf-desc { font-size: 0.88rem; opacity: 0.55; margin-top: 0.4rem; line-height: 1.5; }
.pf-projects-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
.pf-project-card { border-radius: 12px; padding: 1.5rem; transition: transform 0.2s; }
.pf-project-card:hover { transform: translateY(-3px); }
.pf-project-card h3 { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.4rem; }
.pf-project-card p { font-size: 0.9rem; opacity: 0.6; margin-bottom: 0.6rem; }
.pf-project-link { font-size: 0.85rem; font-weight: 600; }
.pf-skills-cloud { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.pf-skill { padding: 0.4rem 1rem; border-radius: 18px; font-size: 0.85rem; font-weight: 600; }
.pf-contact { text-align: center; padding: 3.5rem 2.5rem; }
.pf-contact h2 { font-family: 'Space Grotesk', sans-serif; font-size: 1.6rem; font-weight: 700; margin-bottom: 0.5rem; }
.pf-contact p { opacity: 0.5; font-size: 0.95rem; margin-bottom: 1.5rem; }
.pf-contact a.pf-email-btn { display: inline-block; padding: 0.75rem 2.5rem; border-radius: 8px; font-weight: 700; font-size: 1rem; transition: all 0.2s; }
.pf-footer { text-align: center; padding: 2rem; font-size: 0.78rem; opacity: 0.35; }
.theme-midnight { background: #0f172a; color: #e2e8f0; }
.theme-midnight .pf-hero { background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%); }
.theme-midnight .pf-hero-img { border: 3px solid #334155; }
.theme-midnight .pf-links a { background: rgba(129,140,248,0.12); color: #818cf8; }
.theme-midnight .pf-links a:hover { background: #818cf8; color: #fff; }
.theme-midnight .pf-section-title { color: #818cf8; }
.theme-midnight .pf-timeline::before { background: #334155; }
.theme-midnight .pf-timeline-item::before { border-color: #818cf8; background: #0f172a; }
.theme-midnight .pf-project-card { background: #1e293b; border: 1px solid #334155; }
.theme-midnight .pf-project-link { color: #818cf8; }
.theme-midnight .pf-skill { background: rgba(129,140,248,0.1); color: #a5b4fc; border: 1px solid rgba(129,140,248,0.18); }
.theme-midnight .pf-contact a.pf-email-btn { background: #818cf8; color: #fff; }
.theme-midnight .pf-footer { border-top: 1px solid #1e293b; }
.theme-aurora { background: #0f0c29; color: #e8e0f0; }
.theme-aurora .pf-hero { background: linear-gradient(135deg, #302b63 0%, #24243e 50%, #0f0c29 100%); }
.theme-aurora .pf-hero h1, .theme-aurora .pf-section-title { background: linear-gradient(135deg, #a855f7, #ec4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.theme-aurora .pf-hero-img { border: 3px solid #a855f7; }
.theme-aurora .pf-links a { background: rgba(168,85,247,0.12); color: #c084fc; }
.theme-aurora .pf-links a:hover { background: linear-gradient(135deg, #a855f7, #ec4899); color: #fff; }
.theme-aurora .pf-timeline::before { background: rgba(168,85,247,0.25); }
.theme-aurora .pf-timeline-item::before { border-color: #a855f7; background: #0f0c29; }
.theme-aurora .pf-project-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(168,85,247,0.12); }
.theme-aurora .pf-project-link { color: #c084fc; }
.theme-aurora .pf-skill { background: rgba(168,85,247,0.08); color: #d8b4fe; border: 1px solid rgba(168,85,247,0.18); }
.theme-aurora .pf-contact a.pf-email-btn { background: linear-gradient(135deg, #a855f7, #ec4899); color: #fff; }
.theme-aurora .pf-footer { border-top: 1px solid rgba(168,85,247,0.12); }
.theme-minimal { background: #fafafa; color: #18181b; }
.theme-minimal .pf-hero { background: #ffffff; border-bottom: 1px solid #e4e4e7; }
.theme-minimal .pf-hero .pf-title, .theme-minimal .pf-hero .pf-bio, .theme-minimal .pf-contact p, .theme-minimal .pf-project-card p { color: #71717a; }
.theme-minimal .pf-hero-img { border: 3px solid #e4e4e7; }
.theme-minimal .pf-links a { background: #f4f4f5; color: #18181b; }
.theme-minimal .pf-links a:hover { background: #18181b; color: #fff; }
.theme-minimal .pf-section-title, .theme-minimal .pf-project-link { color: #18181b; }
.theme-minimal .pf-section { border-bottom: 1px solid #f4f4f5; }
.theme-minimal .pf-timeline::before { background: #e4e4e7; }
.theme-minimal .pf-timeline-item::before { border-color: #18181b; background: #fafafa; }
.theme-minimal .pf-project-card { background: #fff; border: 1px solid #e4e4e7; }
.theme-minimal .pf-skill { background: #f4f4f5; color: #3f3f46; border: 1px solid #e4e4e7; }
.theme-minimal .pf-contact a.pf-email-btn { background: #18181b; color: #fff; }
.theme-minimal .pf-footer { border-top: 1px solid #e4e4e7; color: #a1a1aa; }
.theme-forest { background: #0f1a0f; color: #d1e7d1; }
.theme-forest .pf-hero { background: linear-gradient(180deg, #1a2e1a 0%, #0f1a0f 100%); }
.theme-forest .pf-hero-img { border: 3px solid #34d399; }
.theme-forest .pf-links a { background: rgba(52,211,153,0.1); color: #34d399; }
.theme-forest .pf-links a:hover { background: #34d399; color: #0f1a0f; }
.theme-forest .pf-section-title, .theme-forest .pf-project-link { color: #34d399; }
.theme-forest .pf-timeline::before { background: rgba(52,211,153,0.2); }
.theme-forest .pf-timeline-item::before { border-color: #34d399; background: #0f1a0f; }
.theme-forest .pf-project-card { background: #1a2e1a; border: 1px solid rgba(52,211,153,0.12); }
.theme-forest .pf-skill { background: rgba(52,211,153,0.08); color: #6ee7b7; border: 1px solid rgba(52,211,153,0.18); }
.theme-forest .pf-contact a.pf-email-btn { background: #34d399; color: #0f1a0f; }
.theme-forest .pf-footer { border-top: 1px solid #1a2e1a; }
.theme-sunset { background: #1a0a0a; color: #fde8d8; }
.theme-sunset .pf-hero { background: linear-gradient(180deg, #2d1515 0%, #1a0a0a 100%); }
.theme-sunset .pf-hero h1, .theme-sunset .pf-section-title { background: linear-gradient(135deg, #f97316, #fbbf24); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.theme-sunset .pf-hero-img { border: 3px solid #f97316; }
.theme-sunset .pf-links a { background: rgba(249,115,22,0.12); color: #fb923c; }
.theme-sunset .pf-links a:hover { background: linear-gradient(135deg, #f97316, #fbbf24); color: #1a0a0a; }
.theme-sunset .pf-timeline::before { background: rgba(249,115,22,0.2); }
.theme-sunset .pf-timeline-item::before { border-color: #f97316; background: #1a0a0a; }
.theme-sunset .pf-project-card { background: #2d1515; border: 1px solid rgba(249,115,22,0.12); }
.theme-sunset .pf-project-link { color: #fb923c; }
.theme-sunset .pf-skill { background: rgba(249,115,22,0.08); color: #fdba74; border: 1px solid rgba(249,115,22,0.18); }
.theme-sunset .pf-contact a.pf-email-btn { background: linear-gradient(135deg, #f97316, #fbbf24); color: #1a0a0a; }
.theme-sunset .pf-footer { border-top: 1px solid #2d1515; }
.theme-ocean { background: #0a192f; color: #ccd6f6; }
.theme-ocean .pf-hero { background: linear-gradient(180deg, #112240 0%, #0a192f 100%); }
.theme-ocean .pf-hero-img { border: 3px solid #64ffda; }
.theme-ocean .pf-links a { background: rgba(100,255,218,0.08); color: #64ffda; }
.theme-ocean .pf-links a:hover { background: rgba(100,255,218,0.2); }
.theme-ocean .pf-section-title, .theme-ocean .pf-project-link { color: #64ffda; }
.theme-ocean .pf-timeline::before { background: #233554; }
.theme-ocean .pf-timeline-item::before { border-color: #64ffda; background: #0a192f; }
.theme-ocean .pf-project-card { background: #112240; border: 1px solid #233554; }
.theme-ocean .pf-skill { background: rgba(100,255,218,0.06); color: #64ffda; border: 1px solid rgba(100,255,218,0.15); }
.theme-ocean .pf-contact a.pf-email-btn { background: transparent; color: #64ffda; border: 2px solid #64ffda; }
.theme-ocean .pf-footer { border-top: 1px solid #112240; }
.theme-rosegold { background: #1a1118; color: #f5e6ef; }
.theme-rosegold .pf-hero { background: linear-gradient(180deg, #2d1f28 0%, #1a1118 100%); }
.theme-rosegold .pf-hero h1 { background: linear-gradient(135deg, #f43f5e, #fb7185); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.theme-rosegold .pf-hero-img { border: 3px solid #f43f5e; }
.theme-rosegold .pf-links a { background: rgba(244,63,94,0.12); color: #fb7185; }
.theme-rosegold .pf-links a:hover { background: #f43f5e; color: #fff; }
.theme-rosegold .pf-section-title, .theme-rosegold .pf-project-link { color: #fb7185; }
.theme-rosegold .pf-timeline::before { background: rgba(244,63,94,0.2); }
.theme-rosegold .pf-timeline-item::before { border-color: #f43f5e; background: #1a1118; }
.theme-rosegold .pf-project-card { background: #2d1f28; border: 1px solid rgba(244,63,94,0.12); }
.theme-rosegold .pf-skill { background: rgba(244,63,94,0.08); color: #fda4af; border: 1px solid rgba(244,63,94,0.18); }
.theme-rosegold .pf-contact a.pf-email-btn { background: linear-gradient(135deg, #f43f5e, #fb7185); color: #fff; }
.theme-rosegold .pf-footer { border-top: 1px solid #2d1f28; }
.theme-arctic { background: #f0f4ff; color: #1e293b; }
.theme-arctic .pf-hero { background: linear-gradient(180deg, #ffffff 0%, #e8eeff 100%); border-bottom: 1px solid #c7d2fe; }
.theme-arctic .pf-hero .pf-title, .theme-arctic .pf-hero .pf-bio, .theme-arctic .pf-contact p, .theme-arctic .pf-project-card p { color: #64748b; }
.theme-arctic .pf-hero-img { border: 3px solid #3b82f6; }
.theme-arctic .pf-links a { background: rgba(59,130,246,0.1); color: #3b82f6; }
.theme-arctic .pf-links a:hover { background: #3b82f6; color: #fff; }
.theme-arctic .pf-section-title { color: #1e40af; }
.theme-arctic .pf-timeline::before { background: #c7d2fe; }
.theme-arctic .pf-timeline-item::before { border-color: #3b82f6; background: #f0f4ff; }
.theme-arctic .pf-project-card { background: #ffffff; border: 1px solid #c7d2fe; }
.theme-arctic .pf-project-link { color: #3b82f6; }
.theme-arctic .pf-skill { background: rgba(59,130,246,0.08); color: #1e40af; border: 1px solid rgba(59,130,246,0.2); }
.theme-arctic .pf-contact a.pf-email-btn { background: #3b82f6; color: #fff; }
.theme-arctic .pf-footer { border-top: 1px solid #c7d2fe; color: #94a3b8; }
.theme-noir { background: #0a0a0a; color: #e5e5e5; }
.theme-noir .pf-hero { background: linear-gradient(180deg, #171717 0%, #0a0a0a 100%); }
.theme-noir .pf-hero .pf-title { color: #a3a3a3; }
.theme-noir .pf-hero .pf-bio, .theme-noir .pf-project-card p { color: #737373; }
.theme-noir .pf-hero-img { border: 3px solid #404040; }
.theme-noir .pf-links a { background: rgba(255,255,255,0.06); color: #d4d4d4; border: 1px solid rgba(255,255,255,0.08); }
.theme-noir .pf-links a:hover { background: #ffffff; color: #0a0a0a; }
.theme-noir .pf-section-title, .theme-noir .pf-project-link { color: #ffffff; }
.theme-noir .pf-timeline::before { background: #262626; }
.theme-noir .pf-timeline-item::before { border-color: #ffffff; background: #0a0a0a; }
.theme-noir .pf-project-card { background: #171717; border: 1px solid #262626; }
.theme-noir .pf-skill { background: rgba(255,255,255,0.04); color: #d4d4d4; border: 1px solid rgba(255,255,255,0.1); }
.theme-noir .pf-contact a.pf-email-btn { background: #ffffff; color: #0a0a0a; }
.theme-noir .pf-footer { border-top: 1px solid #262626; }
.theme-cyberpunk { background: #0d0221; color: #e0d7ff; }
.theme-cyberpunk .pf-hero { background: linear-gradient(135deg, #1a0a3e 0%, #0d0221 100%); }
.theme-cyberpunk .pf-hero h1 { background: linear-gradient(135deg, #0ff0fc, #ff2a6d); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.theme-cyberpunk .pf-hero .pf-title { color: #0ff0fc; }
.theme-cyberpunk .pf-hero-img { border: 3px solid #0ff0fc; box-shadow: 0 0 15px rgba(15,240,252,0.3); }
.theme-cyberpunk .pf-links a { background: rgba(15,240,252,0.08); color: #0ff0fc; border: 1px solid rgba(15,240,252,0.2); }
.theme-cyberpunk .pf-links a:hover { background: #0ff0fc; color: #0d0221; }
.theme-cyberpunk .pf-section-title, .theme-cyberpunk .pf-project-link { color: #0ff0fc; }
.theme-cyberpunk .pf-timeline::before { background: rgba(255,42,109,0.3); }
.theme-cyberpunk .pf-timeline-item::before { border-color: #ff2a6d; background: #0d0221; box-shadow: 0 0 8px rgba(255,42,109,0.4); }
.theme-cyberpunk .pf-project-card { background: rgba(26,10,62,0.8); border: 1px solid rgba(15,240,252,0.15); }
.theme-cyberpunk .pf-project-link { color: #0ff0fc; }
.theme-cyberpunk .pf-skill { background: rgba(255,42,109,0.08); color: #ff2a6d; border: 1px solid rgba(255,42,109,0.2); }
.theme-cyberpunk .pf-contact a.pf-email-btn { background: linear-gradient(135deg, #0ff0fc, #ff2a6d); color: #0d0221; }
.theme-cyberpunk .pf-footer { border-top: 1px solid rgba(15,240,252,0.1); }
@media (max-width: 600px) { .pf-hero { padding: 3rem 1.5rem; } .pf-hero h1 { font-size: 2rem; } .pf-section, .pf-contact { padding: 2.5rem 1.5rem; } }`;
