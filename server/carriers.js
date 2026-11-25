import ExcelJS from 'exceljs';

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1TXT0xy6IWkSG44PzOlFCNMLWypJcWQHs/export?format=xlsx&gid=733196367';
const CACHE_TTL_MS = 10 * 60 * 1000;

/** Columnas B–J fijas (encabezados son logos, no texto). */
export const CARRIER_COLUMNS = [
  { col: 2, name: 'Envía' },
  { col: 3, name: 'Domina' },
  { col: 4, name: 'Interrapidisimo' },
  { col: 5, name: 'Coordinadora' },
  { col: 6, name: 'TCC' },
  { col: 7, name: 'Veloces' },
  { col: 8, name: 'JAMV Drive' },
  { col: 9, name: 'Wilog' },
  { col: 10, name: 'De Rocha' },
];

const LEVEL_RANK = { alto: 0, medio: 1, bajo: 2 };
const LEVEL_META = {
  alto: { label: 'Mejor resultado', range: '>70%' },
  medio: { label: 'Resultado medio', range: '65–69.9%' },
  bajo: { label: 'Por mejorar', range: '<65%' },
};

/** @type {{ at: number, cities: Map<string, { city: string, carriers: object[] }>, cityNames: string[], warning: string | null } | null} */
let cache = null;

export function normalizeCity(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseArgb(argb) {
  const raw = String(argb || '').replace(/^#/, '').toUpperCase();
  if (raw.length === 8) {
    return {
      r: Number.parseInt(raw.slice(2, 4), 16),
      g: Number.parseInt(raw.slice(4, 6), 16),
      b: Number.parseInt(raw.slice(6, 8), 16),
    };
  }
  if (raw.length === 6) {
    return {
      r: Number.parseInt(raw.slice(0, 2), 16),
      g: Number.parseInt(raw.slice(2, 4), 16),
      b: Number.parseInt(raw.slice(4, 6), 16),
    };
  }
  return null;
}

function extractFillRgb(fill) {
  if (!fill || fill.pattern === 'none') return null;
  const color = fill.fgColor || fill.bgColor;
  if (!color) return null;
  if (color.argb) return parseArgb(color.argb);
  if (color.theme != null) {
    // Tema 6 en esta hoja = gris (sin cobertura / cero).
    if (Number(color.theme) === 6) return { r: 180, g: 180, b: 180 };
  }
  return null;
}

/**
 * Clasifica por rangos RGB (no hex exacto).
 * Verde → alto, amarillo → medio, rojo → bajo, gris → no.
 */
export function levelFromRgb(rgb) {
  if (!rgb) return 'no';
  const { r, g, b } = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  const avg = (r + g + b) / 3;

  if (chroma < 35 && avg >= 120 && avg <= 220) return 'no';
  if (g >= 140 && g > r + 15 && g > b) return 'alto';
  if (r >= 180 && g >= 140 && b < 140) return 'medio';
  if (r >= 160 && r > g + 40 && r > b + 40) return 'bajo';
  if (g > r && g > b && g >= 100) return 'alto';
  if (r > 150 && g > 100 && Math.abs(r - g) < 80 && b < 120) return 'medio';
  if (r > g && r > b && r >= 120) return 'bajo';
  return 'no';
}

/**
 * Leyenda del Sheet / formato condicional:
 * >70% alto, 65–69.9% medio, <65% (y >0) bajo, 0/vacío ocultar.
 */
export function levelFromRate(rate) {
  if (rate == null || !Number.isFinite(rate)) return 'no';
  if (rate <= 0) return 'no';
  if (rate > 0.7) return 'alto';
  if (rate >= 0.65) return 'medio';
  return 'bajo';
}

function cellNumeric(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'object' && value !== null && 'result' in value) {
    return cellNumeric(value.result);
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function levelFromCell(cell) {
  const rate = cellNumeric(cell?.value);
  if (rate != null) return levelFromRate(rate);

  const text = String(cell?.value ?? '').trim();
  if (!text) {
    const rgb = extractFillRgb(cell?.fill);
    return rgb ? levelFromRgb(rgb) : 'no';
  }

  const asNum = Number(text.replace(',', '.'));
  if (Number.isFinite(asNum)) return levelFromRate(asNum);

  const rgb = extractFillRgb(cell?.fill);
  return rgb ? levelFromRgb(rgb) : 'no';
}

function enrichCarrier(name, level) {
  const meta = LEVEL_META[level];
  return {
    name,
    level,
    label: meta.label,
    range: meta.range,
  };
}

export function parseCarriersWorkbook(workbook) {
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    const error = new Error('La hoja de transportadoras está vacía.');
    error.status = 502;
    throw error;
  }

  const cities = new Map();
  const cityNames = [];

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber < 4) return;
    const cityRaw = String(row.getCell(1).value ?? '').trim();
    if (!cityRaw) return;
    const key = normalizeCity(cityRaw);
    if (!key || key === 'CIUDADES') return;

    const carriers = [];
    for (const { col, name } of CARRIER_COLUMNS) {
      const level = levelFromCell(row.getCell(col));
      if (level === 'no') continue;
      carriers.push(enrichCarrier(name, level));
    }
    carriers.sort((a, b) => (
      LEVEL_RANK[a.level] - LEVEL_RANK[b.level]
      || a.name.localeCompare(b.name, 'es')
    ));

    if (!cities.has(key)) cityNames.push(cityRaw);
    cities.set(key, { city: cityRaw, carriers });
  });

  cityNames.sort((a, b) => a.localeCompare(b, 'es'));
  return { cities, cityNames };
}

export async function parseCarriersBuffer(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return parseCarriersWorkbook(workbook);
}

/** Construye un XLSX de prueba con valores/fills controlados (selfcheck). */
export async function buildTestCarriersBuffer() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('CIUDADES');
  sheet.getCell('A2').value = 'SEMAFORO DE CIUDADES POR TRANSPORTADORA';
  sheet.getCell('A3').value = 'CIUDADES';

  sheet.getCell('A4').value = 'BOGOTA';
  // Envía medio (67%), Domina alto, Interrapidisimo bajo; Wilog/De Rocha gris/vacío.
  sheet.getCell('B4').value = 0.677;
  sheet.getCell('C4').value = 0.75;
  sheet.getCell('D4').value = 0.55;
  sheet.getCell('E4').value = 0.72;
  sheet.getCell('F4').value = 0;
  sheet.getCell('G4').value = null;
  sheet.getCell('H4').value = 0.68;
  sheet.getCell('I4').value = null;
  sheet.getCell('I4').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFB0B0B0' },
  };
  sheet.getCell('J4').value = '';
  sheet.getCell('J4').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFBFBFBF' },
  };

  sheet.getCell('A5').value = 'MEDELLIN';
  sheet.getCell('B5').value = 0.69;
  sheet.getCell('C5').value = 0.81;

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function downloadSheet() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(SHEET_URL, {
      signal: controller.signal,
      headers: { Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    });
    if (!response.ok) {
      const error = new Error(`No se pudo descargar el semáforo de transportadoras (${response.status}).`);
      error.status = 502;
      throw error;
    }
    return Buffer.from(await response.arrayBuffer());
  } catch (caught) {
    if (caught?.name === 'AbortError') {
      const error = new Error('La descarga del semáforo de transportadoras tardó demasiado.');
      error.status = 504;
      throw error;
    }
    throw caught;
  } finally {
    clearTimeout(timer);
  }
}

async function refreshCache() {
  const buffer = await downloadSheet();
  const parsed = await parseCarriersBuffer(buffer);
  cache = {
    at: Date.now(),
    cities: parsed.cities,
    cityNames: parsed.cityNames,
    warning: null,
  };
  return cache;
}

async function getCache({ force = false } = {}) {
  const fresh = cache && (Date.now() - cache.at) < CACHE_TTL_MS;
  if (!force && fresh) return cache;

  try {
    return await refreshCache();
  } catch (error) {
    if (cache) {
      return {
        ...cache,
        warning: error.message || 'Usando la última copia guardada del semáforo.',
      };
    }
    throw error;
  }
}

export async function searchCarrierCities(query = '', { refresh = false } = {}) {
  const store = await getCache({ force: refresh });
  const q = normalizeCity(query);
  let items = store.cityNames;
  if (q) {
    items = items.filter((name) => normalizeCity(name).includes(q));
  }
  return {
    items: items.slice(0, 80).map((city) => ({ city, key: normalizeCity(city) })),
    total: items.length,
    stale: Boolean(store.warning),
    warning: store.warning,
    updatedAt: new Date(store.at).toISOString(),
  };
}

export async function lookupCarriers(cityQuery, { refresh = false } = {}) {
  const key = normalizeCity(cityQuery);
  if (!key) {
    const error = new Error('Indica un municipio para consultar.');
    error.status = 400;
    throw error;
  }

  const store = await getCache({ force: refresh });
  let entry = store.cities.get(key);

  if (!entry) {
    const partial = [...store.cities.entries()].find(([cityKey, value]) => (
      cityKey.includes(key) || normalizeCity(value.city).includes(key)
    ));
    entry = partial?.[1] || null;
  }

  if (!entry) {
    const error = new Error('No encontramos ese municipio en el semáforo.');
    error.status = 404;
    throw error;
  }

  return {
    city: entry.city,
    carriers: entry.carriers,
    available: entry.carriers.length,
    stale: Boolean(store.warning),
    warning: store.warning,
    updatedAt: new Date(store.at).toISOString(),
  };
}

/** Invalida y vuelve a bajar el Sheet. */
export async function refreshCarriers() {
  const store = await refreshCache();
  return {
    ok: true,
    cities: store.cityNames.length,
    updatedAt: new Date(store.at).toISOString(),
  };
}

/** Solo para pruebas: inyecta un cache en memoria. */
export function __setCarriersCacheForTests(next) {
  cache = next;
}
