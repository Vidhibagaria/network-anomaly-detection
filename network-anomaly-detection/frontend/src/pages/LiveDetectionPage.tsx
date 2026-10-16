import React, { useState, useEffect, useRef } from 'react';
import { getModels, getStatistics, getWebSocketUrl, Prediction, Statistics } from '../services/api';
import { useToast } from '../App';

export default function LiveDetectionPage() {
  const { addToast } = useToast();
  
  const [models, setModels] = useState<Record<string, any>>({});
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [stats, setStats] = useState<Statistics | null>(null);
  
  // Local state for the live feed
  const [feed, setFeed] = useState<Prediction[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const maxFeedSize = 100;

  useEffect(() => {
    // Load available models and initial stats
    getModels().then(res => {
      const trained = Object.entries(res.models || {}).filter(([, v]) => v.trained).map(([k]) => k);
      setModels(res.models);
      if (trained.length > 0) {
        setSelectedModel(current => current || trained[0]);
      }
    }).catch(console.error);
    
    getStatistics().then(setStats).catch(console.error);
  }, []);

  // Sync stats when they change significantly, or just periodically
  useEffect(() => {
    const t = setInterval(() => {
      if (isSimulating) {
        getStatistics().then(setStats).catch(console.error);
      }
    }, 2000);
    return () => clearInterval(t);
  }, [isSimulating]);

  const toggleSimulation = () => {
    if (isSimulating) {
      stopSimulation();
    } else {
      startSimulation();
    }
  };

  const startSimulation = () => {
    if (!selectedModel) {
      addToast('warning', 'Please select a trained model first');
      return;
    }

    const ws = new WebSocket(
      getWebSocketUrl(`/predict/stream/${selectedModel}?fps=5`)
    );
    
    ws.onopen = () => {
      setIsSimulating(true);
      addToast('success', `Live simulation started using ${selectedModel.replace('_', ' ')}`);
    };
    
    ws.onmessage = (event) => {
      try {
        const data: Prediction = JSON.parse(event.data);
        setFeed(prev => {
          const newFeed = [data, ...prev];
          if (newFeed.length > maxFeedSize) newFeed.pop();
          return newFeed;
        });
      } catch (e) {
        console.error("WebSocket parse error:", e);
      }
    };
    
    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      addToast('error', 'Connection to live stream failed');
      stopSimulation();
    };
    
    ws.onclose = () => {
      setIsSimulating(false);
    };
    
    wsRef.current = ws;
  };

  const stopSimulation = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsSimulating(false);
    addToast('info', 'Live simulation stopped');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  const trainedModelNames = Object.entries(models).filter(([, v]) => v.trained).map(([k]) => k);

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Live Detection</div>
        <div className="page-subtitle">Simulated real-time network traffic analysis using trained models</div>
      </div>

      <div className="page-content">
        
        {/* ── Controls Panel ──────────────────────────────────────── */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="grid-3" style={{ alignItems: 'flex-end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Active Detection Engine</label>
              <select 
                className="input" 
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
                disabled={isSimulating}
              >
                {trainedModelNames.length === 0 && <option value="">No models trained yet</option>}
                {trainedModelNames.map(m => (
                  <option key={m} value={m}>{m.toUpperCase().replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            
            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                className={`btn ${isSimulating ? 'btn-danger' : 'btn-primary'}`}
                onClick={toggleSimulation}
                disabled={trainedModelNames.length === 0}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                {isSimulating ? (
                  <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> STOP CAPTURE</>
                ) : (
                  <>▶ START LIVE CAPTURE</>
                )}
              </button>
            </div>
            
            <div style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-muted)' }}>
              Stream FPS: <strong>5 rows/sec</strong><br/>
              Data source: <strong>Synthetic Generator</strong>
            </div>
          </div>
        </div>

        {/* ── Mini Stats ─────────────────────────────────────────── */}
        <div className="grid-3" style={{ marginBottom: 24 }}>
          <div className="stat-card" style={{ padding: '16px 20px' }}>
            <div className="stat-label">Session Flows</div>
            <div className="stat-value" style={{ fontSize: 24, marginTop: 8 }}>{feed.length}</div>
          </div>
          <div className="stat-card" style={{ padding: '16px 20px' }}>
            <div className="stat-label">Anomalies Detected (Session)</div>
            <div className="stat-value" style={{ fontSize: 24, marginTop: 8, color: 'var(--accent-red)' }}>
              {feed.filter(f => f.is_anomaly).length}
            </div>
          </div>
          <div className="stat-card" style={{ padding: '16px 20px' }}>
            <div className="stat-label">System-Wide Total Alerts</div>
            <div className="stat-value" style={{ fontSize: 24, marginTop: 8 }}>{stats?.total_alerts || 0}</div>
          </div>
        </div>

        {/* ── Live Feed Table ────────────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <span className={`status-dot ${isSimulating ? 'online' : 'offline'}`} style={{ marginRight: 8 }} />
              Live Traffic Feed
            </div>
            {isSimulating && <span style={{ fontSize: 12, color: 'var(--accent-cyan)' }}>Monitoring port 8000...</span>}
          </div>
          
          <div className="table-wrap" style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <table className="data-table">
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)' }}>
                <tr>
                  <th>Timestamp</th>
                  <th>Source IP</th>
                  <th>Dest IP</th>
                  <th>Protocol</th>
                  <th>Model</th>
                  <th>Prediction</th>
                  <th>Confidence</th>
                  <th>Risk Level</th>
                </tr>
              </thead>
              <tbody>
                {feed.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                      No traffic captured yet. Click "Start Live Capture" to begin simulation.
                    </td>
                  </tr>
                ) : (
                  feed.map((row, i) => (
                    <tr key={`${row.row_index}-${i}`} className="live-row">
                      <td style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#64748b' }}>
                        {new Date().toLocaleTimeString()}
                      </td>
                      <td style={{ fontFamily: 'JetBrains Mono', fontSize: 12 }}>{row.source_ip || '192.168.1.10'}</td>
                      <td style={{ fontFamily: 'JetBrains Mono', fontSize: 12 }}>{row.dest_ip || '10.0.0.5'}</td>
                      <td>{row.protocol || 'TCP'}</td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{selectedModel.replace('_', ' ')}</td>
                      <td style={{ color: row.is_anomaly ? 'var(--accent-red)' : 'var(--accent-green)', fontWeight: 600 }}>
                        {row.predicted_class}
                      </td>
                      <td style={{ fontFamily: 'JetBrains Mono', fontSize: 12 }}>
                        {row.confidence != null ? `${(row.confidence * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td>
                        <span className={`badge badge-${(row.risk_level || 'normal').toLowerCase()}`}>
                          {row.risk_level || 'NORMAL'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        
      </div>
    </div>
  );
}
