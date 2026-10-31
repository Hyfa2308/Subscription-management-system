/**
 * REVORA – Health check service.
 * Verifies connectivity between the frontend and backend.
 */

import apiClient from './apiClient';

export interface HealthCheckResponse {
  status: 'ok' | 'error';
  message: string;
  version: string;
  environment: string;
  timestamp: string;
  database: string;
}

export interface ConnectionStatus {
  connected: boolean;
  data?: HealthCheckResponse;
  error?: string;
  latencyMs?: number;
}

/**
 * Pings GET /health and returns connection status.
 * Does not throw — returns a structured result even on failure.
 */
export async function checkHealth(): Promise<ConnectionStatus> {
  const start = Date.now();
  try {
    const response = await apiClient.get<HealthCheckResponse>('/health');
    return {
      connected: response.data.status === 'ok',
      data: response.data,
      latencyMs: Date.now() - start,
    };
  } catch (error: unknown) {
    let message = 'Cannot connect to backend';
    if (error instanceof Error) message = error.message;
    return { connected: false, error: message };
  }
}
