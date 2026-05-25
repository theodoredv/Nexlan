import { NetworkInfo } from '../../../shared/types';

const API_BASE = '/api';

export interface HealthInfo {
  success: boolean;
  message: string;
  uptime: number;
  memory: {
    rss: string;
    heapUsed: string;
    heapTotal: string;
  };
  disk: {
    data: string;
    uploads: string;
    updatedAt: number;
  };
  sse: {
    totalConnections: number;
    channels: Record<string, { connections: number; lastEventId: number }>;
  };
}

export async function getNetworkInfo(): Promise<NetworkInfo> {
  const res = await fetch(`${API_BASE}/network`);
  if (!res.ok) throw new Error('Failed to get network info');
  return res.json();
}

export async function getDeviceName(deviceId: string): Promise<{ deviceId: string; name: string }> {
  const res = await fetch(`${API_BASE}/device-names/${deviceId}`);
  if (!res.ok) throw new Error('Failed to get device name');
  return res.json();
}

export async function setDeviceName(deviceId: string, name: string): Promise<{ deviceId: string; name: string; oldName?: string }> {
  const res = await fetch(`${API_BASE}/device-names/${deviceId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Failed to set device name');
  return res.json();
}

export async function getHealthInfo(): Promise<HealthInfo> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Failed to get health info');
  return res.json();
}
