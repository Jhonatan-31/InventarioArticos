import type { KeyboardEvent, MutableRefObject } from 'react';

const DOUBLE_ENTER_MS = 500;

function focusNextLikeTab(current: HTMLElement, root: Element) {
  const focusables = Array.from(
    root.querySelectorAll<HTMLElement>(
      'input.date-input, button.filter-go:not([disabled])',
    ),
  ).filter((el) => {
    if (el.tabIndex < 0) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
  const index = focusables.indexOf(current);
  if (index < 0) return;
  const next = focusables[index + 1];
  if (!next) return;
  next.focus();
}

/** Enter avanza al siguiente campo; doble Enter aplica el filtro. */
export function handleDateFilterEnterKey(
  event: KeyboardEvent<HTMLInputElement>,
  onFilter: () => void,
  lastEnterAtRef: MutableRefObject<number>,
) {
  if (event.key !== 'Enter') return;
  if (event.nativeEvent.isComposing) return;
  event.preventDefault();
  event.stopPropagation();

  const now = Date.now();
  if (lastEnterAtRef.current > 0 && now - lastEnterAtRef.current <= DOUBLE_ENTER_MS) {
    lastEnterAtRef.current = 0;
    onFilter();
    event.currentTarget.blur();
    return;
  }
  lastEnterAtRef.current = now;

  const root = event.currentTarget.closest('.filter-dates');
  if (!root) return;
  focusNextLikeTab(event.currentTarget, root);
}

function isoDay(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export type DateRangeKey = 'all' | '1' | 'yesterday' | '7' | '15' | '30' | 'month' | 'custom';

export function resolveDateRange(key: DateRangeKey): { from: string; to: string } {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const to = isoDay(today);

  if (key === 'all' || key === 'custom') return { from: '', to: '' };
  if (key === '1') return { from: to, to };
  if (key === 'yesterday') {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const day = isoDay(yesterday);
    return { from: day, to: day };
  }
  if (key === 'month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: isoDay(start), to };
  }
  const days = Number(key);
  const start = new Date(today);
  start.setDate(start.getDate() - (days - 1));
  return { from: isoDay(start), to };
}

export const DATE_RANGE_OPTIONS: Array<{ key: DateRangeKey; label: string }> = [
  { key: 'all', label: 'Todas' },
  { key: '1', label: 'Hoy' },
  { key: 'yesterday', label: 'Ayer' },
  { key: '7', label: '7 días' },
  { key: '15', label: '15 días' },
  { key: '30', label: '30 días' },
  { key: 'month', label: 'Este mes' },
];

/** Mes AAAA-MM → primer y último día de ese mes. */
export function resolveMonthRange(monthValue: string): { from: string; to: string } {
  const match = /^(\d{4})-(\d{2})$/.exec(String(monthValue || '').trim());
  if (!match) return { from: '', to: '' };
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!year || month < 1 || month > 12) return { from: '', to: '' };
  const from = `${match[1]}-${match[2]}-01`;
  const last = new Date(year, month, 0).getDate();
  const to = `${match[1]}-${match[2]}-${String(last).padStart(2, '0')}`;
  return { from, to };
}

const MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** Opciones tipo Chikas Plus: "Noviembre 2026". */
export function listMonthOptions(count = 18): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = [];
  const now = new Date();
  now.setDate(1);
  now.setHours(12, 0, 0, 0);
  for (let i = 0; i < count; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = date.getMonth();
    const value = `${year}-${String(month + 1).padStart(2, '0')}`;
    options.push({ value, label: `${MONTH_LABELS[month]} ${year}` });
  }
  return options;
}
