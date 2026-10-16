import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { getModelComparison, ComparisonResult } from '../services/api';
import { useToast } from '../App';

const PolarAngleAxisAny = PolarAngleAxis as any;
const PolarRadiusAxisAny = PolarRadiusAxis as any;

export default function ModelComparisonPage() {
  const { addToast } = useToast();
  const [data, setData] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchComparison = async () => {
    setLoading(true);
    try {
      const res = await getModelComparison();
      setData(res);
    } catch (err: any) {
      console.error(err);
      addToast('error', `Failed to load comparison data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComparison();
  }, []);

  const modelsList = data ? Object.entries(data.models || {}) : [];
  const comparisonRows = data?.comparison_table || [];

  // Format metrics into charts data
  const barChartData = comparisonRows.map(row => ({
    name: row.model_name.toUpperCase().replace('_', ' '),
    Accuracy: row.accuracy ? +(row.accuracy * 100).toFixed(1) : 0,
    Precision: row.precision ? +(row.precision * 100).toFixed(1) : (row.anomaly_precision ? +(row.anomaly_precision * 100).toFixed(1) : 0),
    Recall: row.recall ? +(row.recall * 100).toFixed(1) : (row.anomaly_recall ? +(row.anomaly_recall * 100).toFixed(1) : 0),
    F1: row.macro_f1 ? +(row.macro_f1 * 100).toFixed(1) : (row.f1_score ? +(row.f1_score * 100).toFixed(1) : (row.anomaly_f1 ? +(row.anomaly_f1 * 100).toFixed(1) : 0)),
  }));

  const speedChartData = comparisonRows.map(row => ({
    name: row.model_name.toUpperCase().replace('_', ' '),
    InferenceMs: row.inference_time_ms ? +row.inference_time_ms.toFixed(3) : 0,
    TrainSeconds: row.training_time_s ? +row.training_time_s.toFixed(1) : 0,
  }));

  // Radar metrics comparison if at least 2 models
  const radarMetrics = [
    { metric: 'Accuracy', fullMark: 100 },
    { metric: 'Precision', fullMark: 100 },
    { metric: 'Recall', fullMark: 100 },
    { metric: 'F1 Score', fullMark: 100 },
  ];

  const radarData = radarMetrics.map(m => {
    const item: any = { metric: m.metric };
    comparisonRows.forEach(row => {
      const key = row.model_name;
      let val = 0;
      if (m.metric === 'Accuracy') val = (row.accuracy || 0) * 100;
      else if (m.metric === 'Precision') val = (row.precision || row.anomaly_precision || 0) * 100;
      else if (m.metric === 'Recall') val = (row.recall || row.anomaly_recall || 0) * 100;
      else if (m.metric === 'F1 Score') val = (row.macro_f1 || row.f1_score || row.anomaly_f1 || 0) * 100;
      item[key] = +val.toFixed(1);
    });
    return item;
  });

  const radarColors: Record<string, string> = {
    random_forest: '#10b981',
    lstm: '#8b5cf6',
    autoencoder: '#f59e0b',
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="page-title">Model Performance & Comparison</div>
          <div className="page-subtitle">Benchmarking accuracy, precision, recall, latency, and anomaly detection efficacy</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchComparison}>
          ↻ Refresh Metrics
        </button>
      </div>

      <div className="page-content">
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh', gap: 12 }}>
            <div className="spinner" />
            <span style={{ color: 'var(--text-secondary)' }}>Comparing trained models...</span>
          </div>
        ) : modelsList.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
            <h3 style={{ fontSize: 18, marginBottom: 8 }}>No Trained Models Found</h3>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto 20px', fontSize: 14 }}>
              To compare model benchmarks and view performance charts, train one or more models (Random Forest, LSTM, or Autoencoder) from the Model Training page.
            </p>
          </div>
        ) : (
          <>
            {/* ── Best Models Highlights ────────────────────────── */}
            <div className="stat-grid" style={{ marginBottom: 24 }}>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--accent-green)' }}>🏆</div>
                <div className="stat-value" style={{ fontSize: 22 }}>
                  {data?.best_supervised ? data.best_supervised.toUpperCase().replace('_', ' ') : 'N/A'}
                </div>
                <div className="stat-label">Top Supervised Model</div>
                <div className="stat-sub">Highest Macro F1 score on test set</div>
              </div>

              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--accent-yellow)' }}>⚡</div>
                <div className="stat-value" style={{ fontSize: 22 }}>
                  {data?.best_anomaly_detector ? data.best_anomaly_detector.toUpperCase().replace('_', ' ') : 'N/A'}
                </div>
                <div className="stat-label">Anomaly Detector</div>
                <div className="stat-sub">Unsupervised reconstruction model</div>
              </div>

              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'rgba(0,212,255,0.15)', color: 'var(--accent-cyan)' }}>📈</div>
                <div className="stat-value" style={{ fontSize: 22 }}>
                  {modelsList.length} / 3
                </div>
                <div className="stat-label">Trained Architecture</div>
                <div className="stat-sub">Active models ready for prediction</div>
              </div>
            </div>

            {/* ── Comparison Table ──────────────────────────────── */}
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header">
                <div className="card-title">Comprehensive Evaluation Matrix</div>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Model Architecture</th>
                      <th>Type</th>
                      <th>Accuracy</th>
                      <th>Precision</th>
                      <th>Recall</th>
                      <th>F1 (Macro/Anomaly)</th>
                      <th>Training Time</th>
                      <th>Inference Latency</th>
                      <th>Test Samples</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonRows.map(row => {
                      const isSupervised = row.model_name !== 'autoencoder';
                      const f1 = isSupervised
                        ? (row.macro_f1 ?? row.f1_score)
                        : (row.anomaly_f1 ?? row.f1_score);
                      const prec = isSupervised ? row.precision : row.anomaly_precision;
                      const rec = isSupervised ? row.recall : row.anomaly_recall;

                      return (
                        <tr key={row.model_name}>
                          <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            {row.model_name.toUpperCase().replace('_', ' ')}
                            {data?.best_supervised === row.model_name && (
                              <span style={{ marginLeft: 8, fontSize: 10, background: 'rgba(16,185,129,0.2)', color: 'var(--accent-green)', padding: '2px 6px', borderRadius: 10 }}>
                                BEST SUPERVISED
                              </span>
                            )}
                          </td>
                          <td style={{ fontSize: 12 }}>
                            {isSupervised ? 'Supervised Multi-Class' : 'Unsupervised Autoencoder'}
                          </td>
                          <td style={{ fontFamily: 'JetBrains Mono', fontWeight: 600 }}>
                            {row.accuracy ? `${(row.accuracy * 100).toFixed(2)}%` : (row.roc_auc ? `AUC ${(row.roc_auc * 100).toFixed(1)}%` : '—')}
                          </td>
                          <td style={{ fontFamily: 'JetBrains Mono', color: prec && prec > 0.8 ? 'var(--accent-green)' : 'inherit' }}>
                            {prec ? `${(prec * 100).toFixed(2)}%` : '—'}
                          </td>
                          <td style={{ fontFamily: 'JetBrains Mono', color: rec && rec > 0.8 ? 'var(--accent-green)' : 'inherit' }}>
                            {rec ? `${(rec * 100).toFixed(2)}%` : '—'}
                          </td>
                          <td style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                            {f1 ? `${(f1 * 100).toFixed(2)}%` : '—'}
                          </td>
                          <td style={{ fontFamily: 'JetBrains Mono' }}>
                            {row.training_time_s ? `${row.training_time_s.toFixed(2)}s` : '—'}
                          </td>
                          <td style={{ fontFamily: 'JetBrains Mono', color: 'var(--accent-yellow)' }}>
                            {row.inference_time_ms ? `${row.inference_time_ms.toFixed(3)}ms` : '—'}
                          </td>
                          <td style={{ fontFamily: 'JetBrains Mono', fontSize: 12 }}>
                            {row.n_samples_test?.toLocaleString() || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {data?.note && (
                <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12 }}>
                  💡 {data.note}
                </div>
              )}
            </div>

            {/* ── Visual Comparison Charts ──────────────────────── */}
            <div className="grid-2" style={{ marginBottom: 24 }}>
              <div className="card">
                <div className="card-header">
                  <div className="card-title">Detection Performance Comparison (%)</div>
                </div>
                <div style={{ height: 300, width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barChartData} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} />
                      <YAxis stroke="var(--text-muted)" fontSize={12} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--glass-border)', borderRadius: 8, fontSize: 12 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="Accuracy" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Precision" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Recall" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="F1" fill="#00d4ff" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <div className="card-title">Latency & Efficiency (Inference ms)</div>
                </div>
                <div style={{ height: 300, width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={speedChartData} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} />
                      <YAxis stroke="var(--text-muted)" fontSize={12} />
                      <Tooltip
                        contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--glass-border)', borderRadius: 8, fontSize: 12 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="InferenceMs" name="Inference Time per Flow (ms)" fill="#ec4899" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="TrainSeconds" name="Total Training Time (s)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* ── Radar Comparison if multiple models ───────────── */}
            {comparisonRows.length >= 2 && (
              <div className="card">
                <div className="card-header">
                  <div className="card-title">Multi-Dimensional Model Profile</div>
                </div>
                <div style={{ height: 320, width: '100%', display: 'flex', justifyContent: 'center' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                      <PolarGrid stroke="rgba(255,255,255,0.1)" />
                      <PolarAngleAxisAny dataKey="metric" stroke="var(--text-secondary)" fontSize={12} />
                      <PolarRadiusAxisAny angle={30} domain={[0, 100]} stroke="var(--text-muted)" fontSize={10} />
                      {comparisonRows.map(row => (
                        <Radar
                          key={row.model_name}
                          name={row.model_name.toUpperCase().replace('_', ' ')}
                          dataKey={row.model_name}
                          stroke={radarColors[row.model_name] || '#00d4ff'}
                          fill={radarColors[row.model_name] || '#00d4ff'}
                          fillOpacity={0.25}
                        />
                      ))}
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Tooltip contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--glass-border)', borderRadius: 8, fontSize: 12 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
