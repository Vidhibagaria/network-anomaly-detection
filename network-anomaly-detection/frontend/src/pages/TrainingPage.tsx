import React, { useState, useEffect } from 'react';
import { 
  getDataStatus, 
  loadDemoDataset, 
  uploadDataset, 
  trainRandomForest, 
  trainLSTM, 
  trainAutoencoder, 
  trainAll,
  getTrainingJobs,
  DataStatus,
  TrainingJob
} from '../services/api';
import { useToast } from '../App';

export default function TrainingPage() {
  const { addToast } = useToast();
  
  // Data state
  const [dataStatus, setDataStatus] = useState<DataStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  
  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  
  // Jobs state
  const [jobs, setJobs] = useState<TrainingJob[]>([]);
  const [activeTab, setActiveTab] = useState<'upload' | 'demo'>('demo');

  const fetchStatus = async () => {
    try {
      const status = await getDataStatus();
      setDataStatus(status);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingStatus(false);
    }
  };

  const fetchJobs = async () => {
    try {
      const res = await getTrainingJobs();
      setJobs(res.jobs);
    } catch (e) {
      console.error(e);
    }
  };

  // Poll status and jobs
  useEffect(() => {
    fetchStatus();
    fetchJobs();
    const interval = setInterval(() => {
      fetchStatus();
      fetchJobs();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleDemoLoad = async () => {
    setLoadingDemo(true);
    try {
      const res = await loadDemoDataset(10000); // Generate 10k samples
      addToast('success', `Demo dataset loaded: ${res.n_rows} flows generated`);
      await fetchStatus();
    } catch (e: any) {
      addToast('error', `Failed to load demo: ${e.response?.data?.detail || e.message}`);
    } finally {
      setLoadingDemo(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    
    setUploading(true);
    try {
      const res = await uploadDataset(file);
      addToast('success', `Dataset processed: ${res.n_rows} rows loaded`);
      setFile(null);
      await fetchStatus();
    } catch (e: any) {
      addToast('error', `Upload failed: ${e.response?.data?.detail || e.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleTrain = async (model: 'rf' | 'lstm' | 'ae' | 'all') => {
    if (!dataStatus?.n_train) {
      addToast('error', 'No dataset loaded. Load data first.');
      return;
    }
    
    try {
      if (model === 'rf') await trainRandomForest();
      else if (model === 'lstm') await trainLSTM();
      else if (model === 'ae') await trainAutoencoder();
      else if (model === 'all') await trainAll();
      
      addToast('success', `Training job for ${model.toUpperCase()} started`);
      fetchJobs();
    } catch (e: any) {
      addToast('error', `Failed to start training: ${e.response?.data?.detail || e.message}`);
    }
  };

  const hasData = dataStatus && dataStatus.status === 'ready';
  const runningJobs = jobs.filter(j => j.status === 'running' || j.status === 'pending');

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Model Training Studio</div>
        <div className="page-subtitle">Prepare datasets and train AI anomaly detection models</div>
      </div>

      <div className="page-content">
        <div className="grid-2">
          
          {/* ── Data Source Panel ──────────────────────────────────────── */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">1. Data Source</div>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              <button 
                className={`btn ${activeTab === 'demo' ? 'btn-primary' : 'btn-secondary'}`} 
                onClick={() => setActiveTab('demo')}
                style={{ flex: 1 }}
              >
                Use Demo Dataset
              </button>
              <button 
                className={`btn ${activeTab === 'upload' ? 'btn-primary' : 'btn-secondary'}`} 
                onClick={() => setActiveTab('upload')}
                style={{ flex: 1 }}
              >
                Upload CIC-IDS 2017
              </button>
            </div>

            {activeTab === 'demo' && (
              <div style={{ textAlign: 'center', padding: '20px 10px' }}>
                <div className="demo-banner" style={{ justifyContent: 'center' }}>
                  ⚠ Generates synthetic network traffic for testing purposes
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
                  Instantly load a balanced, synthetic dataset representing normal traffic and 
                  various attacks (DoS, PortScan, etc.) mimicking CIC-IDS 2017 feature structures.
                </p>
                <button 
                  className="btn btn-primary btn-lg" 
                  onClick={handleDemoLoad}
                  disabled={loadingDemo || uploading}
                >
                  {loadingDemo ? 'Generating...' : 'Load Demo Dataset'}
                </button>
              </div>
            )}

            {activeTab === 'upload' && (
              <form onSubmit={handleUpload}>
                <div 
                  className={`upload-zone ${file ? 'has-file' : ''}`}
                  onClick={() => document.getElementById('csv-upload')?.click()}
                >
                  <div className="upload-icon">📁</div>
                  <h3>{file ? file.name : 'Select CSV Dataset'}</h3>
                  <p>{file ? `${(file.size / (1024*1024)).toFixed(2)} MB` : 'CIC-IDS 2017 traffic capture'}</p>
                  <input 
                    type="file" 
                    id="csv-upload" 
                    accept=".csv" 
                    style={{ display: 'none' }}
                    onChange={e => setFile(e.target.files?.[0] || null)}
                  />
                </div>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ width: '100%', marginTop: 16 }}
                  disabled={!file || uploading || loadingDemo}
                >
                  {uploading ? 'Processing Data...' : 'Upload & Preprocess'}
                </button>
              </form>
            )}

            {/* Current Data Status */}
            <div style={{ marginTop: 24, padding: 16, background: 'rgba(0,0,0,0.2)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12 }}>
                Current Dataset Pipeline
              </div>
              
              {!loadingStatus && dataStatus ? (
                <div>
                  <div className="metric-row">
                    <span className="metric-label">Status</span>
                    <span className={`badge ${dataStatus.status === 'ready' ? 'badge-normal' : 'badge-low'}`}>
                      {dataStatus.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Training Samples</span>
                    <span className="metric-value">{dataStatus.n_train?.toLocaleString() || '0'}</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Testing Samples</span>
                    <span className="metric-value">{dataStatus.n_test?.toLocaleString() || '0'}</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Features</span>
                    <span className="metric-value">{dataStatus.n_features || '0'}</span>
                  </div>
                </div>
              ) : (
                <div className="spinner" style={{ margin: '0 auto' }} />
              )}
            </div>
          </div>

          {/* ── Training Panel ─────────────────────────────────────────── */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">2. AI Models</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Random Forest */}
              <div className="model-card">
                <div className="model-header">
                  <div className="model-icon rf">🌲</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>Random Forest Classifier</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Supervised multi-class attack classification</div>
                  </div>
                </div>
                <button 
                  className="btn btn-secondary btn-sm" 
                  style={{ width: '100%' }}
                  disabled={!hasData || runningJobs.some(j => j.model_name === 'random_forest')}
                  onClick={() => handleTrain('rf')}
                >
                  {runningJobs.some(j => j.model_name === 'random_forest') ? 'Training...' : 'Train Random Forest'}
                </button>
              </div>

              {/* LSTM */}
              <div className="model-card">
                <div className="model-header">
                  <div className="model-icon lstm">🧠</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>LSTM Sequence Model</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Deep learning temporal pattern recognition</div>
                  </div>
                </div>
                <button 
                  className="btn btn-secondary btn-sm" 
                  style={{ width: '100%' }}
                  disabled={!hasData || runningJobs.some(j => j.model_name === 'lstm')}
                  onClick={() => handleTrain('lstm')}
                >
                  {runningJobs.some(j => j.model_name === 'lstm') ? 'Training...' : 'Train LSTM Model'}
                </button>
              </div>

              {/* Autoencoder */}
              <div className="model-card">
                <div className="model-header">
                  <div className="model-icon ae">⭘</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>Deep Autoencoder</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Unsupervised zero-day anomaly detection</div>
                  </div>
                </div>
                <button 
                  className="btn btn-secondary btn-sm" 
                  style={{ width: '100%' }}
                  disabled={!hasData || runningJobs.some(j => j.model_name === 'autoencoder')}
                  onClick={() => handleTrain('ae')}
                >
                  {runningJobs.some(j => j.model_name === 'autoencoder') ? 'Training...' : 'Train Autoencoder'}
                </button>
              </div>

              {/* Train All */}
              <button 
                className="btn btn-primary" 
                disabled={!hasData || runningJobs.length > 0}
                onClick={() => handleTrain('all')}
                style={{ marginTop: 8 }}
              >
                Launch Full Training Pipeline
              </button>

            </div>
          </div>
        </div>

        {/* ── Active Jobs ───────────────────────────────────────────── */}
        {jobs.length > 0 && (
          <div className="card" style={{ marginTop: '20px' }}>
            <div className="card-header">
              <div className="card-title">Training Job Log</div>
              <button className="btn btn-ghost btn-sm" onClick={fetchJobs}>↻</button>
            </div>
            
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Job ID</th>
                    <th>Model</th>
                    <th>Status</th>
                    <th>Progress</th>
                    <th>Message</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.slice().reverse().map(job => (
                    <tr key={job.job_id}>
                      <td style={{ fontFamily: 'JetBrains Mono', fontSize: 11 }}>{job.job_id.substring(0,8)}</td>
                      <td>{job.model_name.replace('_', ' ')}</td>
                      <td>
                        <span className={`badge badge-${
                          job.status === 'done' ? 'normal' : 
                          job.status === 'error' ? 'critical' : 
                          job.status === 'running' ? 'low' : 'medium'
                        }`}>
                          {job.status}
                        </span>
                      </td>
                      <td style={{ width: 120 }}>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${job.progress}%` }} />
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{job.message}</td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {job.started_at ? new Date(job.started_at).toLocaleTimeString() : '—'}
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
