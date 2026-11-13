import { COLOMBIA_CITIES_RAW } from './colombiaCities';

export type ColombiaCity = {
  code: string;
  city: string;
  department: string;
};

export const COLOMBIA_CITIES = COLOMBIA_CITIES_RAW as unknown as ColombiaCity[];

export function findColombiaCity(codeOrLabel: string) {
  const text = String(codeOrLabel || '').trim();
  if (!text) return null;
  const byCode = COLOMBIA_CITIES.find((item) => item.code === text);
  if (byCode) return byCode;
  const lower = text.toLowerCase();
  return COLOMBIA_CITIES.find((item) => (
    `${item.city}, ${item.department}`.toLowerCase() === lower
    || `${item.city} — ${item.department}`.toLowerCase() === lower
    || item.city.toLowerCase() === lower
  )) || null;
}

export function cityOptionLabel(item: ColombiaCity) {
  return `${item.city} — ${item.department}`;
}
