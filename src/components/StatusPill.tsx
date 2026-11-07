import { labelStateLabel, movementLabel, statusLabel } from '../format';

function normalizeStatus(status?: string | null) {
  return String(status || '').trim().toLowerCase();
}

export function StatusPill({
  status,
  channel,
}: {
  status: string;
  channel?: string | null;
  returnedAt?: string | null;
}) {
  const normalized = normalizeStatus(status);
  if (normalized === 'salida' && channel === 'paginas') {
    return <span className="pill paginas">Salió a páginas</span>;
  }
  if (normalized === 'salida' && channel === 'dropi') {
    return <span className="pill dropi">Salió a Dropi</span>;
  }
  if (normalized === 'salida' && channel === 'fabrica') {
    return <span className="pill fabrica">Salió a fábrica</span>;
  }
  if (normalized === 'prioridad' || normalized === 'devolucion') {
    return <span className="pill devolucion">Devolución</span>;
  }
  return <span className={`pill ${normalized}`}>{statusLabel[normalized] || status}</span>;
}

export function MovementPill({ type }: { type: string }) {
  return <span className={`pill move ${type}`}>{movementLabel[type] || type}</span>;
}

export function LabelPill({ state }: { state: string }) {
  return <span className={`pill label-${state}`}>{labelStateLabel[state] || state}</span>;
}
