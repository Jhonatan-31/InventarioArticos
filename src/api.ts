import type {
  AccountingData,
  Channel,
  DashboardData,
  Incident,
  LabelCheck,
  Movement,
  Pair,
  PairBatch,
  PairPage,
  BodegaData,
  Reference,
  ReferenceInput,
} from './types';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers || {}),
      },
    });
  } catch {
    throw new Error('No hay conexión con el servidor del inventario.');
  }
  const text = await response.text();
  const data = text ? JSON.parse(text) as { error?: string } : {};
  if (!response.ok) throw new Error(data.error || 'No se pudo completar la operación.');
  return data as T;
}

export const getSession = () => request<{ required: boolean; ok: boolean }>('/api/session');

export function login(password: string) {
  return request<{ ok: boolean }>('/api/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export const getDashboard = () => request<DashboardData>('/api/dashboard');
export const getSequence = () => request<{ nextQr: string; nextNumber: number }>('/api/sequence');
export const getReferences = () => request<Reference[]>('/api/references');
export const getBodega = () => request<BodegaData>('/api/bodega');
export const getAccounting = () => request<AccountingData>('/api/accounting');

export function createReference(body: ReferenceInput) {
  return request<Reference>('/api/references', { method: 'POST', body: JSON.stringify(body) });
}

export function updateReference(id: string, body: ReferenceInput) {
  return request<Reference>(`/api/references/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function deleteReference(id: string) {
  return request<{ ok: boolean }>(`/api/references/${id}`, { method: 'DELETE' });
}

export function addStock(id: string, quantities: Record<string, number>, note: string) {
  return request<PairBatch>(`/api/references/${id}/pairs`, {
    method: 'POST',
    body: JSON.stringify({ quantities, note }),
  });
}

export function getPairs(params: Record<string, string>) {
  const query = new URLSearchParams(params);
  return request<PairPage>(`/api/pairs?${query.toString()}`);
}

export function lookupPair(code: string) {
  return request<Pair>(`/api/pairs/lookup?code=${encodeURIComponent(code)}`);
}

export function scanPair(code: string, mode: 'salida' | 'devolucion', channel?: Channel) {
  return request<{ pair: Pair; message: string }>('/api/scan', {
    method: 'POST',
    body: JSON.stringify({ code, mode, channel }),
  });
}

export function addPayment(channel: Channel, amount: number, note: string) {
  return request<AccountingData>('/api/payments', {
    method: 'POST',
    body: JSON.stringify({ channel, amount, note }),
  });
}

export const getIncidents = () => request<Incident[]>('/api/incidents');

export function createIncident(code: string, description: string) {
  return request<{ pair: Pair; incident: Incident }>('/api/incidents', {
    method: 'POST',
    body: JSON.stringify({ code, description }),
  });
}

export const getMovements = () => request<Movement[]>('/api/movements?limit=200');

export function checkLabels(pairIds: string[]) {
  return request<LabelCheck>('/api/labels/check', {
    method: 'POST',
    body: JSON.stringify({ pairIds }),
  });
}

export function confirmLabels(pairIds: string[]) {
  return request<Pair[]>('/api/labels/confirm', {
    method: 'POST',
    body: JSON.stringify({ pairIds }),
  });
}

export async function downloadExcel() {
  let response: Response;
  try {
    response = await fetch('/api/reports/excel');
  } catch {
    throw new Error('No hay conexión con el servidor del inventario.');
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: 'No se pudo generar el informe.' }));
    throw new Error(data.error || 'No se pudo generar el informe.');
  }
  const blob = await response.blob();
  const name = response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1]
    || 'Calzado-Evalook-Inventario.xlsx';
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
