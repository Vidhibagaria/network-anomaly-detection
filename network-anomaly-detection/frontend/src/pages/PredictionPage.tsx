import React, { useState, useEffect } from 'react';
import { 
  getModels, 
  getDataStatus, 
  getPresets,
  predictBatch, 
  predictSingle, 
  BatchPredictionResult, 
  Prediction, 
  DataStatus 
} from '../services/api';
import { useToast } from '../App';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend
} from 'recharts';

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#00d4ff'];

export default function PredictionPage() {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'batch' | 'single'>('batch');

  // Models and Pipeline status
  const [models, setModels] = useState<Record<string, any>>({});
  const [dataStatus, setDataStatus] = useState<DataStatus | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('random_forest');

  // Batch prediction state
  const [file, setFile] = useState<File | null>(null);
  const [sampleLimit, setSampleLimit] = useState<number>(500);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchPredictionResult | null>(null);
  const [filterRisk, setFilterRisk] = useState<string>('ALL');

  // Single flow state
  const [singleLoading, setSingleLoading] = useState(false);
  const [singleResult, setSingleResult] = useState<Prediction | null>(null);
  const [flowPresets, setFlowPresets] = useState<Record<string, Record<string, number>>>({});
  const [featureInputs, setFeatureInputs] = useState<Record<string, number>>({});

  useEffect(() => {
    getModels().then(res => {
      setModels(res.models || {});
      const trainedList = Object.entries(res.models || {}).filter(([, v]) => v.trained).map(([k]) => k);
      if (trainedList.length > 0 && !trainedList.includes(selectedModel)) {
        setSelectedModel(trainedList[0]);
      }
    }).catch(console.error);

    getDataStatus().then(setDataStatus).catch(console.error);

    getPresets().then(presets => {
      setFlowPresets(presets);
      if (presets.BENIGN) setFeatureInputs(presets.BENIGN);
    }).catch(err => {
      console.error(err);
      addToast('error', 'Unable to load the verified single-flow samples');
    });
  }, []);

  const trainedModelNames = Object.entries(models).filter(([, v]) => v.trained).map(([k]) => k);

  const handleBatchPredict = async () => {
    if (!file) {
      addToast('warning', 'Please select a CSV file first');
      return;
    }
    if (!selectedModel) {
      addToast('warning', 'Please select a model');
      return;
    }

    setBatchLoading(true);
    try {
      const res = await predictBatch(file, selectedModel, sampleLimit > 0 ? sampleLimit : undefined);
      setBatchResult(res);
      addToast('success', `Completed analysis of ${res.n_predictions} flows (${res.n_anomalies} anomalies identified)`);
    } catch (err: any) {
      console.error(err);
      addToast('error', `Prediction failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setBatchLoading(false);
    }
  };

  const handleSinglePredict = async () => {
    if (!selectedModel) {
      addToast('warning', 'Please select a model');
      return;
    }
    setSingleLoading(true);
    try {
      const res = await predictSingle(featureInputs, selectedModel);
      setSingleResult(res);
      addToast('success', `Prediction completed: ${res.predicted_class} (${res.risk_level})`);
    } catch (err: any) {
      console.error(err);
      addToast('error', `Single prediction failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setSingleLoading(false);
    }
  };

  const handleFeatureChange = (key: string, val: string) => {
    const num = parseFloat(val);
    setFeatureInputs(prev => ({
      ...prev,
      [key]: isNaN(num) ? 0 : num,
    }));
  };

  const attackPieData = batchResult
    ? Object.entries(batchResult.attack_distribution || {}).map(([name, value]) => ({ name, value }))
    : [];

  const filteredPredictions = (batchResult?.predictions || []).filter(p => {
    if (filterRisk === 'ALL') return true;
    if (filterRisk === 'ANOMALY_ONLY') return p.is_anomaly;
    return p.risk_level?.toUpperCase() === filterRisk;
  });

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="page-title">Run Inference & Predictions</div>
          <div className="page-subtitle">Analyze live captures, batch traffic CSVs, or isolated packet flows</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={`btn btn-sm ${activeTab === 'batch' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('batch')}
          >
            📁 Batch CSV Inspection
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'single' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('single')}
          >
            ⚡ Single Flow Inspector
          </button>
        </div>
      </div>

      <div className="page-content">
        {/* Model Selector Banner */}
        <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <label className="form-label" style={{ marginBottom: 4 }}>Select Detection Model</label>
                <select
                  className="input"
                  value={selectedModel}
                  onChange={e => setSelectedModel(e.target.value)}
                  style={{ minWidth: 240 }}
                >
                  {trainedModelNames.length === 0 && <option value="">No trained models found</option>}
                  {trainedModelNames.map(m => (
                    <option key={m} value={m}>
                      {m.toUpperCase().replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label" style={{ marginBottom: 4 }}>Feature Pipeline Status</label>
                <div style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, height: 40 }}>
                  <span className={`status-dot ${dataStatus?.pipeline_saved ? 'online' : 'offline'}`} />
                  {dataStatus?.pipeline_saved ? (
                    <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>Ready ({dataStatus.n_features} features)</span>
                  ) : (
                    <span style={{ color: 'var(--accent-red)' }}>Missing pipeline (Upload dataset first)</span>
                  )}
                </div>
              </div>
            </div>

            {trainedModelNames.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--accent-yellow)', background: 'rgba(245,158,11,0.1)', padding: '8px 12px', borderRadius: 6 }}>
                ⚠️ No models are currently trained. Please visit the Model Training page to train Random Forest or LSTM first.
              </div>
            )}
          </div>
        </div>

        {/* ── BATCH INFERENCE TAB ───────────────────────────── */}
        {activeTab === 'batch' && (
          <div>
            <div className="grid-2" style={{ marginBottom: 24 }}>
              {/* Upload Card */}
              <div className="card">
                <div className="card-header">
                  <div className="card-title">Upload Network Capture (CSV)</div>
                </div>

                <div
                  className="upload-zone"
                  onClick={() => document.getElementById('batch-file-input')?.click()}
                  style={{ borderStyle: file ? 'solid' : 'dashed', borderColor: file ? 'var(--accent-cyan)' : undefined }}
                >
                  <input
                    id="batch-file-input"
                    type="file"
                    accept=".csv"
                    style={{ display: 'none' }}
                    onChange={e => e.target.files?.[0] && setFile(e.target.files[0])}
                  />
                  <div className="upload-icon">📄</div>
                  <h3>{file ? file.name : 'Click to select CSV file'}</h3>
                  <p>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB · Ready for analysis` : 'Supports standard CIC-IDS2017 / NetFlow capture CSVs'}</p>
                </div>

                <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Max Flows To Analyze</label>
                    <select
                      className="input"
                      value={sampleLimit}
                      onChange={e => setSampleLimit(Number(e.target.value))}
                    >
                      <option value={100}>First 100 rows (Fastest)</option>
                      <option value={500}>First 500 rows</option>
                      <option value={2000}>First 2,000 rows</option>
                      <option value={5000}>First 5,000 rows</option>
                      <option value={0}>All rows</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button
                      className="btn btn-primary"
                      onClick={handleBatchPredict}
                      disabled={!file || batchLoading || trainedModelNames.length === 0}
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      {batchLoading ? (
                        <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Analyzing...</>
                      ) : (
                        '⚡ Run Batch Inference'
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Summary Stats Card */}
              <div className="card">
                <div className="card-header">
                  <div className="card-title">Batch Detection Summary</div>
                </div>

                {!batchResult ? (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div>
                    <p style={{ fontSize: 13 }}>Select a file and run batch prediction to see threat analytics, anomaly rates, and packet classifications.</p>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                      <div style={{ background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 8 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>TOTAL FLOWS</div>
                        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'JetBrains Mono' }}>{batchResult.n_predictions.toLocaleString()}</div>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 8 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>MALICIOUS FLOWS</div>
                        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'JetBrains Mono', color: 'var(--accent-red)' }}>{batchResult.n_anomalies.toLocaleString()}</div>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 8 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ANOMALY RATE</div>
                        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'JetBrains Mono', color: 'var(--accent-yellow)' }}>{(batchResult.anomaly_rate * 100).toFixed(1)}%</div>
                      </div>
                    </div>

                    <div style={{ height: 180, width: '100%' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={attackPieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={65}
                            innerRadius={35}
                          >
                            {attackPieData.map((_, idx) => (
                              <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--glass-border)', borderRadius: 8, fontSize: 12 }} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Results Table */}
            {batchResult && (
              <div className="card">
                <div className="card-header">
                  <div className="card-title">Flow-by-Flow Classification Log</div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Filter Severity:</label>
                    <select
                      className="input"
                      value={filterRisk}
                      onChange={e => setFilterRisk(e.target.value)}
                      style={{ padding: '4px 10px', fontSize: 12, width: 'auto' }}
                    >
                      <option value="ALL">All Flows</option>
                      <option value="ANOMALY_ONLY">Anomalies Only</option>
                      <option value="CRITICAL">Critical Only</option>
                      <option value="HIGH">High Only</option>
                      <option value="MEDIUM">Medium Only</option>
                      <option value="NORMAL">Normal Only</option>
                    </select>
                  </div>
                </div>

                <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Predicted Class</th>
                        <th>Severity</th>
                        <th>Confidence</th>
                        <th>Source IP</th>
                        <th>Dest IP</th>
                        <th>Protocol</th>
                        <th>Anomaly Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPredictions.slice(0, 150).map((pred, i) => (
                        <tr key={i}>
                          <td style={{ fontFamily: 'JetBrains Mono', fontSize: 12 }}>{pred.row_index ?? i + 1}</td>
                          <td style={{ fontWeight: 600, color: pred.is_anomaly ? 'var(--accent-red)' : 'var(--text-primary)' }}>
                            {pred.predicted_class}
                          </td>
                          <td>
                            <span className={`badge badge-${(pred.risk_level || 'normal').toLowerCase()}`}>
                              {pred.risk_level}
                            </span>
                          </td>
                          <td style={{ fontFamily: 'JetBrains Mono' }}>
                            {(pred.confidence * 100).toFixed(1)}%
                          </td>
                          <td style={{ fontFamily: 'JetBrains Mono', fontSize: 12 }}>{pred.source_ip || '—'}</td>
                          <td style={{ fontFamily: 'JetBrains Mono', fontSize: 12 }}>{pred.dest_ip || '—'}</td>
                          <td>
                            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4 }}>
                              {pred.protocol || 'TCP'}
                            </span>
                          </td>
                          <td style={{ fontFamily: 'JetBrains Mono', fontSize: 12 }}>
                            {pred.anomaly_score !== undefined ? pred.anomaly_score.toFixed(4) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filteredPredictions.length > 150 && (
                  <div style={{ textAlign: 'center', padding: '10px 0', fontSize: 12, color: 'var(--text-muted)' }}>
                    Displaying first 150 of {filteredPredictions.length} matching rows.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── SINGLE FLOW TESTER TAB ───────────────────────── */}
        {activeTab === 'single' && (
          <div className="grid-2">
            <div className="card">
              <div className="card-header">
                <div className="card-title">Simulate Flow Telemetry Parameters</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={!flowPresets.BENIGN}
                    onClick={() => {
                      setFeatureInputs(flowPresets.BENIGN);
                      setSingleResult(null);
                    }}
                  >
                    Sample Normal Flow
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={!flowPresets.DoS}
                    onClick={() => {
                      setFeatureInputs(flowPresets.DoS);
                      setSingleResult(null);
                    }}
                  >
                    Sample DoS Attack
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxHeight: 420, overflowY: 'auto', paddingRight: 6 }}>
                {Object.entries(featureInputs).map(([k, v]) => (
                  <div key={k} className="form-group" style={{ marginBottom: 8 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>{k}</label>
                    <input
                      type="number"
                      className="input"
                      value={v}
                      onChange={e => handleFeatureChange(k, e.target.value)}
                    />
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 20 }}>
                <button
                  className="btn btn-primary"
                  onClick={handleSinglePredict}
                  disabled={singleLoading || trainedModelNames.length === 0}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {singleLoading ? (
                    <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Classifying...</>
                  ) : (
                    '⚡ Evaluate Flow Anomaly'
                  )}
                </button>
              </div>
            </div>

            {/* Single Result Viewer */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Real-Time Classification Verdict</div>
              </div>

              {!singleResult ? (
                <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>⚡</div>
                  <p style={{ fontSize: 14 }}>Enter custom flow attributes or load a sample preset, then click Evaluate Flow Anomaly.</p>
                </div>
              ) : (
                <div>
                  <div style={{
                    padding: 20,
                    borderRadius: 'var(--radius-lg)',
                    background: singleResult.is_anomaly ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                    border: `1px solid ${singleResult.is_anomaly ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                    marginBottom: 20,
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>
                      Inference Result
                    </div>
                    <div style={{
                      fontSize: 32,
                      fontWeight: 800,
                      marginTop: 4,
                      color: singleResult.is_anomaly ? 'var(--accent-red)' : 'var(--accent-green)'
                    }}>
                      {singleResult.predicted_class}
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <span className={`badge badge-${(singleResult.risk_level || 'normal').toLowerCase()}`}>
                        Risk: {singleResult.risk_level}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>CONFIDENCE SCORE</div>
                      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'JetBrains Mono', color: 'var(--accent-cyan)' }}>
                        {(singleResult.confidence * 100).toFixed(2)}%
                      </div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ANOMALY PROBABILITY</div>
                      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'JetBrains Mono', color: 'var(--accent-yellow)' }}>
                        {(singleResult.anomaly_score * 100).toFixed(2)}%
                      </div>
                    </div>
                  </div>

                  {singleResult.all_probabilities && (
                    <div>
                      <div className="form-label" style={{ marginBottom: 10 }}>Class Probabilities</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {Object.entries(singleResult.all_probabilities).map(([cName, prob]) => (
                          <div key={cName}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                              <span>{cName}</span>
                              <span style={{ fontFamily: 'JetBrains Mono' }}>{(prob * 100).toFixed(1)}%</span>
                            </div>
                            <div className="progress-bar">
                              <div
                                className="progress-fill"
                                style={{
                                  width: `${prob * 100}%`,
                                  background: cName.toUpperCase() === 'BENIGN' ? 'var(--accent-green)' : 'var(--accent-red)'
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
