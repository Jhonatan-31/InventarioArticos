export const SHOE_SIZES = ['34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45'];

export function formatMoney(value?: number | null) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

export function formatDay(iso?: string | null) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Bogota',
  }).format(new Date(iso));
}

export function formatWhen(iso?: string | null) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'America/Bogota',
  }).format(new Date(iso));
}

export const statusLabel: Record<string, string> = {
  inventario: 'En inventario',
  salida: 'Salió',
  prioridad: 'Devolución',
};

export const movementLabel: Record<string, string> = {
  entrada: 'Entrada',
  salida: 'Salida',
  devolucion: 'Devolución',
  novedad: 'Novedad',
  reimpresion: 'Reimpresión',
};

export const channelLabel: Record<string, string> = {
  paginas: 'Páginas',
  dropi: 'Dropi',
  fabrica: 'Fábrica',
};

export const labelStateLabel: Record<string, string> = {
  por_confirmar: 'Por confirmar',
  activa: 'Etiqueta activa',
  reimpresion: 'Lista para reimprimir',
};
