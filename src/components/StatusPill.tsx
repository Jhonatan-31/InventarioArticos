import { labelStateLabel, movementLabel, statusLabel } from '../format';

export function StatusPill({ status, channel }: { status: string; channel?: string | null }) {
  if (status === 'salida' && channel === 'paginas') return <span className="pill paginas">Salió a páginas</span>;
  if (status === 'salida' && channel === 'dropi') return <span className="pill dropi">Salió a Dropi</span>;
  if (status === 'prioridad') return <span className="pill devolucion">Devolución</span>;
  return <span className={`pill ${status}`}>{statusLabel[status] || status}</span>;
}

export function MovementPill({ type }: { type: string }) {
  return <span className={`pill move ${type}`}>{movementLabel[type] || type}</span>;
}

export function LabelPill({ state }: { state: string }) {
  return <span className={`pill label-${state}`}>{labelStateLabel[state] || state}</span>;
}
