/**
 * API service layer for communicating with the FastAPI backend.
 * All requests go through this module — never hardcoded or faked.
 */

import axios from 'axios';

// Vercel routes /api/* to the backend service. REACT_APP_API_URL remains an
// optional build-time override for deployments where the API uses another host.
export const BASE_URL = process.env.REACT_APP_API_URL || '/api/v1';

export const getWebSocketUrl = (path: string): string => {
  const base = new URL(`${BASE_URL.replace(/\/$/, '')}/`, window.location.origin);
  const url = new URL(path.replace(/^\//, ''), base);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
};

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 300000, // 5 min for training
});

// ── Types ──────────────────────────────────────────────────────────────────

export interface ModelMetrics {
  model_name: string;
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1_score?: number;
  macro_f1?: number;
  weighted_f1?: number;
  training_time_s?: number;
  inference_time_ms?: number;
  n_samples_train?: number;
  n_samples_test?: number;
  n_features?: number;
  classification_report?: Record<string, any>;
  confusion_matrix?: number[][];
  class_names?: string[];
  // Autoencoder-specific
  anomaly_precision?: number;
  anomaly_recall?: number;
  anomaly_f1?: number;
  roc_auc?: number;
  threshold?: number;
  training_history?: { loss: number[]; val_loss: number[]; accuracy?: number[]; val_accuracy?: number[] };
  feature_importance?: Record<string, number>;
  top_features?: Array<{ feature: string; importance: number }>;
  note?: string;
}

export interface TrainingJob {
  job_id: string;
  model_name: string;
  status: 'pending' | 'running' | 'done' | 'error';
  progress: number;
  message: string;
  error?: string;
  result?: ModelMetrics;
  started_at?: string;
  finished_at?: string;
}

export interface Prediction {
  row_index: number;
  predicted_class: string;
  confidence: number;
  is_anomaly: boolean;
  anomaly_score: number;
  risk_level: string;
  all_probabilities?: Record<string, number>;
  source_ip?: string;
  dest_ip?: string;
  protocol?: string;
  src_port?: string;
  dst_port?: string;
  true_label?: string;
  note?: string;
}

export interface BatchPredictionResult {
  model_name: string;
  n_predictions: number;
  n_anomalies: number;
  anomaly_rate: number;
  inference_time_s: number;
  attack_distribution: Record<string, number>;
  predictions: Prediction[];
}

export interface Alert {
  id: number;
  created_at: string;
  alert_type: string;
  risk_level: string;
  model_name?: string;
  confidence?: number;
  anomaly_score?: number;
  source_ip?: string;
  dest_ip?: string;
  protocol?: string;
  description?: string;
  acknowledged: boolean;
  is_demo: boolean;
}

export interface Statistics {
  total_flows: number;
  benign_flows: number;
  malicious_flows: number;
  anomaly_rate: number;
  attack_distribution: Record<string, number>;
  alert_distribution: Record<string, number>;
  total_alerts: number;
  recent_predictions: Prediction[];
}

export interface ComparisonResult {
  models: Record<string, ModelMetrics>;
  comparison_table: ModelMetrics[];
  best_supervised?: string;
  best_anomaly_detector?: string;
  note?: string;
  message?: string;
}

export interface DataStatus {
  status: string;
  n_train?: number;
  n_test?: number;
  n_features?: number;
  class_names?: string[];
  pipeline_saved?: boolean;
  message?: string;
}

export interface UploadResult {
  n_rows: number;
  n_features: number;
  n_train: number;
  n_test: number;
  n_train_after_smote: number;
  label_column: string;
  class_names: string[];
  label_distribution: Record<string, number>;
  raw_label_distribution: Record<string, number>;
  preprocessing_log: string[];
  filename: string;
  is_demo: boolean;
  demo_warning?: string;
}

// ── API calls ──────────────────────────────────────────────────────────────

// Health
export const getHealth = () => api.get('/health').then(r => r.data);

// Data
export const uploadDataset = (file: File, labelColumn?: string, nrows?: number) => {
  const form = new FormData();
  form.append('file', file);
  if (labelColumn) form.append('label_column', labelColumn);
  if (nrows) form.append('nrows', String(nrows));
  return api.post<UploadResult>('/data/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
};

export const loadDemoDataset = (nSamples: number = 5000) => {
  const form = new FormData();
  form.append('n_samples', String(nSamples));
  return api.post<UploadResult>('/data/demo', form).then(r => r.data);
};

export const getDataStatus = () => api.get<DataStatus>('/data/status').then(r => r.data);

// Training
export const trainRandomForest = (params?: Record<string, any>) =>
  api.post<{ job_id: string; status: string }>('/models/train/random-forest', params || {}).then(r => r.data);

export const trainLSTM = (params?: Record<string, any>) =>
  api.post<{ job_id: string; status: string }>('/models/train/lstm', params || {}).then(r => r.data);

export const trainAutoencoder = (params?: Record<string, any>) =>
  api.post<{ job_id: string; status: string }>('/models/train/autoencoder', params || {}).then(r => r.data);

export const trainAll = (params?: Record<string, any>) =>
  api.post<{ job_ids: Record<string, string> }>('/models/train/all', params || {}).then(r => r.data);

export const getTrainingJobs = () =>
  api.get<{ jobs: TrainingJob[] }>('/models/jobs').then(r => r.data);

export const getTrainingJob = (jobId: string) =>
  api.get<TrainingJob>(`/models/jobs/${jobId}`).then(r => r.data);

export const getModels = () =>
  api.get<{ models: Record<string, { trained: boolean; metrics: Partial<ModelMetrics> | null }> }>('/models').then(r => r.data);

export const getModelMetrics = (modelName: string) =>
  api.get<ModelMetrics>(`/models/${modelName}/metrics`).then(r => r.data);

// Prediction
export const predictBatch = (file: File, modelName: string, nrows?: number) => {
  const form = new FormData();
  form.append('file', file);
  form.append('model_name', modelName);
  if (nrows) form.append('nrows', String(nrows));
  return api.post<BatchPredictionResult>('/predict/batch', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
};

export const predictSingle = (features: Record<string, number>, modelName: string = 'random_forest') => {
  return api.post<Prediction>('/predict/single', { features, model_name: modelName }).then(r => r.data);
};

export const getPresets = () =>
  api.get<Record<string, Record<string, number>>>('/predict/presets').then(r => r.data);

// Analytics
export const getStatistics = () => api.get<Statistics>('/statistics').then(r => r.data);
export const getAlerts = (params?: { limit?: number; risk_level?: string }) =>
  api.get<{ count: number; alerts: Alert[] }>('/alerts', { params }).then(r => r.data);
export const acknowledgeAlert = (id: number) =>
  api.post(`/alerts/${id}/acknowledge`).then(r => r.data);
export const seedAlerts = () =>
  api.post<{ status: string; seeded: number }>('/alerts/seed').then(r => r.data);
export const getModelComparison = () =>
  api.get<ComparisonResult>('/model-comparison').then(r => r.data);

export default api;
