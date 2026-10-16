import React, { useState, useEffect, createContext, useContext } from 'react';
import './index.css';
import { getHealth } from './services/api';

// ── Pages ──────────────────────────────────────────────────────────────────
import OverviewPage from './pages/OverviewPage';
import TrainingPage from './pages/TrainingPage';
import PredictionPage from './pages/PredictionPage';
import LiveDetectionPage from './pages/LiveDetectionPage';
import ModelComparisonPage from './pages/ModelComparisonPage';
import AlertsPage from './pages/AlertsPage';

// ── Toast context ──────────────────────────────────────────────────────────
interface Toast { id: string; type: 'success'|'error'|'info'|'warning'; message: string; }
interface ToastCtx { addToast: (type: Toast['type'], message: string) => void; }
export const ToastContext = createContext<ToastCtx>({ addToast: () => {} });
export const useToast = () => useContext(ToastContext);

// ── Nav items ──────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'overview',    label: 'Overview',         icon: '⬡',  section: 'Dashboard' },
  { id: 'live',        label: 'Live Detection',    icon: '⊕',  section: 'Dashboard' },
  { id: 'alerts',      label: 'Alerts',            icon: '◈',  section: 'Dashboard', badge: true },
  { id: 'training',    label: 'Model Training',    icon: '⟳',  section: 'Models' },
  { id: 'comparison',  label: 'Model Comparison',  icon: '⊞',  section: 'Models' },
  { id: 'prediction',  label: 'Run Prediction',    icon: '⊡',  section: 'Analysis' },
];

// ── App ────────────────────────────────────────────────────────────────────
function App() {
  const [activePage, setActivePage] = useState('overview');
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [alertCount, setAlertCount] = useState(0);

  const addToast = (type: Toast['type'], message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  // Backend health check
  useEffect(() => {
    const check = async () => {
      try {
        await getHealth();
        setBackendOnline(true);
      } catch {
        setBackendOnline(false);
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  const renderPage = () => {
    switch (activePage) {
      case 'overview':    return <OverviewPage />;
      case 'training':    return <TrainingPage />;
      case 'prediction':  return <PredictionPage />;
      case 'live':        return <LiveDetectionPage />;
      case 'comparison':  return <ModelComparisonPage />;
      case 'alerts':      return <AlertsPage onCountChange={setAlertCount} />;
      default:            return <OverviewPage />;
    }
  };
  const sections = Array.from(new Set(NAV_ITEMS.map(n => n.section)));

  return (
    <ToastContext.Provider value={{ addToast }}>
      <div className="app-layout">
        {/* ── Sidebar ─────────────────────────────────────────────── */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="logo-icon">🛡</div>
            <h1>NetGuard AI</h1>
            <p>v1.0.0 · Anomaly Detection</p>
          </div>

          <nav className="sidebar-nav">
            {sections.map(section => (
              <div key={section}>
                <div className="nav-section-label">{section}</div>
                {NAV_ITEMS.filter(n => n.section === section).map(item => (
                  <button
                    key={item.id}
                    className={`nav-item ${activePage === item.id ? 'active' : ''}`}
                    onClick={() => setActivePage(item.id)}
                    id={`nav-${item.id}`}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    {item.label}
                    {item.badge && alertCount > 0 && (
                      <span className="nav-badge">{alertCount > 99 ? '99+' : alertCount}</span>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </nav>

          <div className="sidebar-status">
            <span className={`status-dot ${backendOnline ? 'online' : 'offline'}`} />
            Backend: {backendOnline === null ? 'Checking…' : backendOnline ? 'Online' : 'Offline'}
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────────────── */}
        <main className="main-content">
          {!backendOnline && backendOnline !== null && (
            <div style={{
              background: 'rgba(239,68,68,0.1)', borderBottom: '1px solid rgba(239,68,68,0.3)',
              padding: '10px 28px', fontSize: '13px', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '8px'
            }}>
              ⚠️ Backend is offline. Start the FastAPI server:&nbsp;
              <code style={{ fontFamily: 'JetBrains Mono', background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: '4px' }}>
                uvicorn backend.main:app --reload
              </code>
            </div>
          )}
          {renderPage()}
        </main>
      </div>

      {/* ── Toasts ───────────────────────────────────────────────── */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span>{t.type === 'success' ? '✓' : t.type === 'error' ? '✗' : t.type === 'warning' ? '⚠' : 'ℹ'}</span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export default App;
