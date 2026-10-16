/**
 * Overview / Dashboard page — real data from backend statistics endpoint.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid,
} from 'recharts';
import { getStatistics, getModels, Statistics } from '../services/api';

const COLORS = ['#10b981','#ef4444','#8b5cf6','#3b82f6','#f59e0b','#f97316','#ec4899','#00d4ff','#06b6d4'];

const formatNum = (n: number) => n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1000 ? `${(n/1000).toFixed(1)}K` : n.toString();
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export default function OverviewPage() {
  const [stats, setStats] = useState<Statistics | null>(null);
  const [models, setModels] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, m] = await Promise.all([getStatistics(), getModels()]);
      setStats(s);
      setModels(m.models || {});
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to load statistics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  const attackChartData = stats
    ? Object.entries(stats.attack_distribution)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
    : [];

  const benignVsMalicious = stats
    ? [
        { name: 'Benign', value: stats.benign_flows },
        { name: 'Malicious', value: stats.malicious_flows },
      ]
    : [];

  const trainedModels = Object.entries(models).filter(([, v]) => v.trained);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="spinner" style={{ width: 40, height: 40 }} />
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div className="page-title">System Overview</div>
        <div className="page-subtitle">Real-time network traffic anomaly detection statistics</div>
      </div>

      <div className="page-content">
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8, padding: '12px 16px', color: '#fca5a5', fontSize: 13, marginBottom: 20 }}>
            ⚠️ {error} — Make sure the backend is running.
          </div>
        )}

        {/* ── Stat cards ─────────────────────────────────────────── */}
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(0,212,255,0.1)' }}>⬡</div>
            <div className="stat-value">{formatNum(stats?.total_flows ?? 0)}</div>
            <div className="stat-label">Total Flows Analyzed</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(16,185,129,0.1)' }}>✓</div>
            <div className="stat-value" style={{ color: '#10b981' }}>{formatNum(stats?.benign_flows ?? 0)}</div>
            <div className="stat-label">Benign Flows</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(239,68,68,0.1)' }}>⚠</div>
            <div className="stat-value" style={{ color: '#ef4444' }}>{formatNum(stats?.malicious_flows ?? 0)}</div>
            <div className="stat-label">Malicious Flows</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(245,158,11,0.1)' }}>%</div>
            <div className="stat-value" style={{ color: '#f59e0b' }}>
              {stats ? pct(stats.anomaly_rate) : '0%'}
            </div>
            <div className="stat-label">Anomaly Rate</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(139,92,246,0.1)' }}>◈</div>
            <div className="stat-value">{stats?.total_alerts ?? 0}</div>
            <div className="stat-label">Total Alerts</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(59,130,246,0.1)' }}>⊞</div>
            <div className="stat-value">{trainedModels.length}</div>
            <div className="stat-label">Models Trained</div>
            <div className="stat-sub">{trainedModels.map(([n]) => n.replace('_', ' ')).join(', ') || 'None yet'}</div>
          </div>
        </div>

        {/* ── Charts row ─────────────────────────────────────────── */}
        <div className="grid-2" style={{ marginBottom: 20 }}>
          {/* Benign vs Malicious pie */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Traffic Distribution</div>
            </div>
            {stats && stats.total_flows > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={benignVsMalicious} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}>
                    <Cell fill="#10b981" />
                    <Cell fill="#ef4444" />
                  </Pie>
                  <Tooltip contentStyle={{ background: '#0f1929', border: '1px solid rgba(99,179,237,0.15)', borderRadius: 8, color: '#e2e8f0' }} />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 13 }}>
                No prediction data yet. Run predictions to see traffic distribution.
              </div>
            )}
          </div>

          {/* Attack distribution bar */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Attack Category Distribution</div>
            </div>
            {attackChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={attackChartData} margin={{ top: 4, right: 8, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} angle={-30} textAnchor="end" />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ background: '#0f1929', border: '1px solid rgba(99,179,237,0.15)', borderRadius: 8, color: '#e2e8f0' }} />
                  <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                    {attackChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 13 }}>
                No predictions yet.
              </div>
            )}
          </div>
        </div>

        {/* ── Trained model summary ──────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Trained Models Summary</div>
            <button className="btn btn-ghost btn-sm" onClick={load}>↻ Refresh</button>
          </div>
          {trainedModels.length > 0 ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>Accuracy</th>
                    <th>Macro F1</th>
                    <th>Weighted F1</th>
                    <th>Train Samples</th>
                    <th>Train Time</th>
                  </tr>
                </thead>
                <tbody>
                  {trainedModels.map(([name, info]) => {
                    const m = info.metrics || {};
                    return (
                      <tr key={name}>
                        <td><span style={{ fontFamily: 'JetBrains Mono', fontSize: 12 }}>{name.replace('_', ' ')}</span></td>
                        <td className="metric-value">{m.accuracy != null ? pct(m.accuracy) : '—'}</td>
                        <td className="metric-value">{m.macro_f1 != null ? pct(m.macro_f1) : '—'}</td>
                        <td className="metric-value">{m.weighted_f1 != null ? pct(m.weighted_f1) : '—'}</td>
                        <td style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: '#94a3b8' }}>
                          {m.n_samples_train != null ? formatNum(m.n_samples_train) : '—'}
                        </td>
                        <td style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: '#94a3b8' }}>
                          {m.training_time_s != null ? `${m.training_time_s.toFixed(1)}s` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', color: '#475569', fontSize: 13 }}>
              No models trained yet. Go to <strong>Model Training</strong> to train models.
            </div>
          )}
        </div>

        {/* ── Recent predictions ─────────────────────────────────── */}
        {stats && stats.recent_predictions.length > 0 && (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-header">
              <div className="card-title">Recent Predictions</div>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Time</th><th>Model</th><th>Prediction</th><th>Confidence</th><th>Risk</th></tr>
                </thead>
                <tbody>
                  {stats.recent_predictions.slice(0, 15).map((p: any, i) => (
                    <tr key={i}>
                      <td style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#64748b' }}>
                        {p.predicted_at ? new Date(p.predicted_at).toLocaleTimeString() : '—'}
                      </td>
                      <td style={{ color: '#94a3b8', fontSize: 12 }}>{p.model_name?.replace('_', ' ')}</td>
                      <td style={{ color: p.is_anomaly ? '#ef4444' : '#10b981', fontWeight: 600 }}>{p.predicted_class}</td>
                      <td style={{ fontFamily: 'JetBrains Mono', fontSize: 12 }}>
                        {p.confidence != null ? pct(p.confidence) : '—'}
                      </td>
                      <td>
                        <span className={`badge badge-${(p.risk_level || 'normal').toLowerCase()}`}>
                          {p.risk_level || 'NORMAL'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
