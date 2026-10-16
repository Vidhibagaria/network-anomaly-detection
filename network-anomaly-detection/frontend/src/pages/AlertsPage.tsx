import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getAlerts, acknowledgeAlert, seedAlerts, Alert } from '../services/api';
import { useToast } from '../App';

interface AlertsPageProps {
  onCountChange?: (count: number) => void;
}

export default function AlertsPage({ onCountChange }: AlertsPageProps) {
  const { addToast } = useToast();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [riskFilter, setRiskFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ACKNOWLEDGED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  const fetchAlertsList = useCallback(async (showLoadingState = false) => {
    if (showLoadingState) setLoading(true);
    try {
      const res = await getAlerts({ limit: 300 });
      const fetched = res.alerts || [];
      setAlerts(fetched);
      const unacknowledgedCount = fetched.filter(a => !a.acknowledged).length;
      if (onCountChange) {
        onCountChange(unacknowledgedCount);
      }
    } catch (err: any) {
      console.error(err);
      if (showLoadingState) {
        addToast('error', `Failed to load alerts: ${err.message || 'Server error'}`);
      }
    } finally {
      if (showLoadingState) setLoading(false);
    }
  }, [addToast, onCountChange]);

  useEffect(() => {
    fetchAlertsList(true);
  }, [fetchAlertsList]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchAlertsList(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchAlertsList]);

  const handleAcknowledge = async (id: number) => {
    try {
      await acknowledgeAlert(id);
      setAlerts(prev =>
        prev.map(a => (a.id === id ? { ...a, acknowledged: true } : a))
      );
      if (selectedAlert && selectedAlert.id === id) {
        setSelectedAlert(prev => (prev ? { ...prev, acknowledged: true } : null));
      }
      addToast('success', `Alert #${id} marked as acknowledged`);
      
      const unack = alerts.filter(a => a.id !== id && !a.acknowledged).length;
      if (onCountChange) onCountChange(unack);
    } catch (err: any) {
      addToast('error', `Failed to acknowledge alert: ${err.message}`);
    }
  };

  const handleAcknowledgeAllVisible = async () => {
    const unacknowledged = filteredAlerts.filter(a => !a.acknowledged);
    if (unacknowledged.length === 0) return;
    try {
      await Promise.all(unacknowledged.map(a => acknowledgeAlert(a.id)));
      setAlerts(prev =>
        prev.map(a =>
          unacknowledged.some(u => u.id === a.id) ? { ...a, acknowledged: true } : a
        )
      );
      addToast('success', `Acknowledged ${unacknowledged.length} alerts`);
      fetchAlertsList(false);
    } catch (err: any) {
      addToast('error', 'Failed acknowledging some alerts');
    }
  };

  const filteredAlerts = useMemo(() => {
    return alerts.filter(a => {
      if (riskFilter !== 'ALL' && a.risk_level?.toUpperCase() !== riskFilter) return false;
      if (statusFilter === 'ACTIVE' && a.acknowledged) return false;
      if (statusFilter === 'ACKNOWLEDGED' && !a.acknowledged) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const src = (a.source_ip || '').toLowerCase();
        const dst = (a.dest_ip || '').toLowerCase();
        const proto = (a.protocol || '').toLowerCase();
        const type = (a.alert_type || '').toLowerCase();
        const desc = (a.description || '').toLowerCase();
        if (!src.includes(q) && !dst.includes(q) && !proto.includes(q) && !type.includes(q) && !desc.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [alerts, riskFilter, statusFilter, searchQuery]);

  const activeCount = alerts.filter(a => !a.acknowledged).length;
  const criticalCount = alerts.filter(a => a.risk_level === 'CRITICAL' && !a.acknowledged).length;
  const highCount = alerts.filter(a => a.risk_level === 'HIGH' && !a.acknowledged).length;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="page-title">Security Incidents & Alerts</div>
          <div className="page-subtitle">Real-time detected anomalies, threat classification and mitigation log</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={async () => {
              try {
                await seedAlerts();
                addToast('success', 'Sample incidents generated');
                fetchAlertsList(false);
              } catch (e: any) {
                addToast('error', `Failed to seed alerts: ${e.message}`);
              }
            }}
          >
            + Generate Sample Incidents
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh (5s)
          </label>
          <button className="btn btn-secondary btn-sm" onClick={() => fetchAlertsList(true)}>
            ↻ Refresh
          </button>
          {filteredAlerts.some(a => !a.acknowledged) && (
            <button className="btn btn-primary btn-sm" onClick={handleAcknowledgeAllVisible}>
              ✓ Acknowledge All Filtered
            </button>
          )}
        </div>
      </div>

      <div className="page-content">
        {/* ── Stat Cards ────────────────────────────────────── */}
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--accent-red)' }}>🚨</div>
            <div className="stat-value">{activeCount}</div>
            <div className="stat-label">Active Unresolved</div>
            <div className="stat-sub">Needs immediate triage</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(239,68,68,0.2)', color: 'var(--risk-critical)' }}>🔥</div>
            <div className="stat-value" style={{ color: 'var(--risk-critical)' }}>{criticalCount}</div>
            <div className="stat-label">Critical Threats</div>
            <div className="stat-sub">High severity anomalies</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(249,115,22,0.15)', color: 'var(--risk-high)' }}>⚡</div>
            <div className="stat-value" style={{ color: 'var(--risk-high)' }}>{highCount}</div>
            <div className="stat-label">High Priority</div>
            <div className="stat-sub">Targeted network attacks</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--accent-green)' }}>🛡</div>
            <div className="stat-value">{alerts.filter(a => a.acknowledged).length}</div>
            <div className="stat-label">Acknowledged</div>
            <div className="stat-sub">Historical reviewed items</div>
          </div>
        </div>

        {/* ── Filter bar ────────────────────────────────────── */}
        <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', flex: 1, minWidth: 300 }}>
              <input
                type="text"
                className="input"
                placeholder="Search by IP address, protocol, attack type..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ maxWidth: 360 }}
              />

              <select
                className="input"
                value={riskFilter}
                onChange={e => setRiskFilter(e.target.value)}
                style={{ width: 'auto', minWidth: 150 }}
              >
                <option value="ALL">All Risk Levels</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>

              <select
                className="input"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                style={{ width: 'auto', minWidth: 150 }}
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="ACKNOWLEDGED">Acknowledged Only</option>
              </select>
            </div>

            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Showing {filteredAlerts.length} of {alerts.length} total alerts
            </div>
          </div>
        </div>

        {/* ── Main List & Details ───────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: selectedAlert ? '1fr 400px' : '1fr', gap: 20, alignItems: 'start' }}>
          <div className="card">
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 12 }}>
                <div className="spinner" />
                <span style={{ color: 'var(--text-secondary)' }}>Loading alerts log...</span>
              </div>
            ) : filteredAlerts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 42, marginBottom: 12 }}>🛡️</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>No alerts found</div>
                <p style={{ marginTop: 6, fontSize: 13 }}>
                  {alerts.length === 0
                    ? 'No malicious traffic or anomalies have been detected yet. Run a prediction batch or start Live Detection to stream network flows.'
                    : 'No alerts match your active filter criteria.'}
                </p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 60 }}>ID</th>
                      <th>Time</th>
                      <th>Risk</th>
                      <th>Attack / Anomaly Type</th>
                      <th>Source → Dest</th>
                      <th>Protocol</th>
                      <th>Confidence</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAlerts.map(alert => {
                      const riskKey = (alert.risk_level || 'medium').toLowerCase();
                      const isSelected = selectedAlert?.id === alert.id;
                      return (
                        <tr
                          key={alert.id}
                          onClick={() => setSelectedAlert(alert)}
                          style={{
                            cursor: 'pointer',
                            background: isSelected ? 'rgba(0, 212, 255, 0.08)' : undefined,
                          }}
                        >
                          <td style={{ fontFamily: 'JetBrains Mono', fontSize: 12 }}>#{alert.id}</td>
                          <td style={{ fontSize: 12, whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                            {alert.created_at ? new Date(alert.created_at).toLocaleTimeString() : 'Just now'}
                          </td>
                          <td>
                            <span className={`badge badge-${riskKey}`}>
                              {alert.risk_level}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {alert.alert_type}
                          </td>
                          <td style={{ fontFamily: 'JetBrains Mono', fontSize: 12 }}>
                            {alert.source_ip || '192.168.1.X'} <span style={{ color: 'var(--text-muted)' }}>→</span> {alert.dest_ip || '10.0.0.1'}
                          </td>
                          <td>
                            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4 }}>
                              {alert.protocol || 'TCP'}
                            </span>
                          </td>
                          <td style={{ fontFamily: 'JetBrains Mono' }}>
                            {alert.confidence !== undefined && alert.confidence !== null
                              ? `${(alert.confidence * 100).toFixed(1)}%`
                              : alert.anomaly_score !== undefined && alert.anomaly_score !== null
                              ? `Score: ${alert.anomaly_score.toFixed(2)}`
                              : 'N/A'}
                          </td>
                          <td>
                            {alert.acknowledged ? (
                              <span style={{ color: 'var(--accent-green)', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                ✓ Resolved
                              </span>
                            ) : (
                              <span style={{ color: 'var(--accent-red)', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                ● Unresolved
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                            {!alert.acknowledged ? (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleAcknowledge(alert.id)}
                                title="Mark as resolved / acknowledged"
                              >
                                ✓ Acknowledge
                              </button>
                            ) : (
                              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Acknowledged</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Slide-over Details Panel ─────────────────────── */}
          {selectedAlert && (
            <div
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                position: 'sticky',
                top: 80,
                maxHeight: 'calc(100vh - 100px)',
                overflowY: 'auto',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 2, paddingBottom: 6 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Incident Details</div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSelectedAlert(null)}
                >
                  ✕
                </button>
              </div>

              <div style={{ padding: 12, background: 'rgba(0,0,0,0.3)', borderRadius: 'var(--radius-md)', border: 'var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Alert ID</span>
                  <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 600 }}>#{selectedAlert.id}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Classification</span>
                  <span style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>{selectedAlert.alert_type}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Severity</span>
                  <span className={`badge badge-${(selectedAlert.risk_level || 'medium').toLowerCase()}`}>
                    {selectedAlert.risk_level}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Timestamp</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {selectedAlert.created_at ? new Date(selectedAlert.created_at).toLocaleString() : 'N/A'}
                  </span>
                </div>
              </div>

              <div>
                <div className="form-label">Network Coordinates</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, fontFamily: 'JetBrains Mono' }}>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px 10px', borderRadius: 4 }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>SOURCE IP</div>
                    <div>{selectedAlert.source_ip || 'Unknown'}</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px 10px', borderRadius: 4 }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>DESTINATION IP</div>
                    <div>{selectedAlert.dest_ip || 'Unknown'}</div>
                  </div>
                </div>
              </div>

              <div>
                <div className="form-label">Model Attribution</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Engine: <strong style={{ color: 'var(--text-primary)' }}>{selectedAlert.model_name || 'Network Security Model'}</strong>
                </div>
                {selectedAlert.confidence !== undefined && selectedAlert.confidence !== null && (
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Confidence: <strong style={{ color: 'var(--accent-green)' }}>{(selectedAlert.confidence * 100).toFixed(1)}%</strong>
                  </div>
                )}
                {selectedAlert.anomaly_score !== undefined && selectedAlert.anomaly_score !== null && (
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Anomaly Score: <strong style={{ color: 'var(--accent-yellow)' }}>{selectedAlert.anomaly_score.toFixed(4)}</strong>
                  </div>
                )}
              </div>

              {selectedAlert.description && (
                <div>
                  <div className="form-label">Summary / Description</div>
                  <div style={{ fontSize: 13, background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 6, color: 'var(--text-secondary)' }}>
                    {selectedAlert.description}
                  </div>
                </div>
              )}

              <div style={{ marginTop: 'auto', paddingTop: 12 }}>
                {!selectedAlert.acknowledged ? (
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => handleAcknowledge(selectedAlert.id)}
                  >
                    ✓ Mark as Acknowledged
                  </button>
                ) : (
                  <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--accent-green)', padding: 8 }}>
                    ✓ This incident has been resolved
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
