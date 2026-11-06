import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getDb, imagesDir } from './db.js';

const db = getDb();
export const SHOE_SIZES = ['34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45'];

const PAIR_SELECT = `
SELECT
  p.id, p.qr_number, p.qr_code, p.payload, p.reference_id, p.status, p.channel AS pair_channel,
  p.size AS pair_size,
  p.created_at, p.exited_at, p.returned_at, p.printed_at, p.exit_count, p.return_count,
  r.code AS reference_code, r.name AS reference_name, r.color AS reference_color,
  r.size AS reference_size, r.line AS reference_line, r.price AS reference_price,
  (SELECT COUNT(*) FROM incidents i WHERE i.pair_id = p.id AND i.reprinted_at IS NULL) AS open_incidents
FROM pairs p
JOIN shoe_refs r ON r.id = p.reference_id
`;

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function transaction(work) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch { /* already closed */ }
    throw error;
  }
}

function isUnique(error) {
  return String(error?.message || '').includes('UNIQUE');
}

export function canonicalQr(number) {
  return String(number).padStart(5, '0');
}

export function parseScan(raw) {
  const text = String(raw || '').trim().toUpperCase();
  if (!text) return null;
  let token = text;
  if (text.includes('|')) {
    const parts = text.split('|').map((part) => part.trim());
    if (parts[0] === 'EVALOOK' && parts[1]) token = parts[1];
  }
  if (!/^\d+$/.test(token)) return null;
  const number = Number(token);
  if (!Number.isSafeInteger(number) || number < 1) return null;
  return { qrCode: canonicalQr(number), payload: text };
}

function requiredText(value, label, max, min = 2) {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  if (text.length < min) fail(400, `${label} es obligatorio.`);
  if (text.length > max) fail(400, `${label} admite máximo ${max} caracteres.`);
  return text;
}

function cleanCode(value) {
  const code = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!/^[A-Z0-9][A-Z0-9\-/_.]{0,23}$/.test(code)) {
    fail(400, 'El código de referencia usa letras, números y guiones. Máximo 24 caracteres.');
  }
  return code;
}

function cleanLine(value) {
  const line = String(value || '').trim();
  const allowed = ['Dama', 'Caballero', 'Infantil', 'Unisex'];
  if (!allowed.includes(line)) fail(400, 'Elige una línea: Dama, Caballero, Infantil o Unisex.');
  return line;
}

function cleanPrice(value) {
  const price = Number(value);
  if (!Number.isInteger(price) || price < 0 || price > 100000000) {
    fail(400, 'El precio debe ser un entero en pesos, entre 0 y 100.000.000.');
  }
  return price;
}

function cleanOptional(value, max) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function pesos(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function channelName(channel) {
  return channel === 'dropi' ? 'Dropi' : 'páginas';
}

function stockLeft(referenceId, size) {
  return Number(db.prepare(`
    SELECT COUNT(*) AS n
    FROM pairs
    WHERE reference_id = ? AND size = ? AND status IN ('inventario', 'prioridad')
  `).get(referenceId, size).n);
}

function saveImage(dataUrl) {
  const match = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=\s]+)$/.exec(String(dataUrl || ''));
  if (!match) fail(400, 'La imagen no es válida. Usa JPG, PNG o WEBP.');
  const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (buffer.length < 32 || buffer.length > 1200000) {
    fail(400, 'La imagen debe pesar menos de 1.2 MB.');
  }
  fs.mkdirSync(imagesDir(), { recursive: true });
  const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
  const filename = `${crypto.randomUUID()}.${ext}`;
  fs.writeFileSync(path.join(imagesDir(), filename), buffer);
  return filename;
}

function keepImage(input, currentName) {
  if (input === undefined || input === null || input === '') return currentName || '';
  if (typeof input === 'string' && input.startsWith('/api/media/')) return currentName || '';
  return saveImage(input);
}

function mapPair(row) {
  if (!row) return null;
  const open = Number(row.open_incidents || 0) > 0;
  const canPrint = !row.printed_at || open;
  return {
    id: row.id,
    qrNumber: row.qr_number,
    qrCode: row.qr_code,
    payload: row.payload,
    referenceId: row.reference_id,
    referenceCode: row.reference_code,
    name: row.reference_name,
    color: row.reference_color,
    size: row.pair_size || row.reference_size,
    line: row.reference_line,
    channel: row.pair_channel,
    price: Number(row.reference_price || 0),
    status: row.status,
    createdAt: row.created_at,
    exitedAt: row.exited_at,
    returnedAt: row.returned_at,
    printedAt: row.printed_at,
    exitCount: row.exit_count,
    returnCount: row.return_count,
    canPrint,
    reprintAuthorized: Boolean(row.printed_at) && open,
    labelState: !row.printed_at ? 'por_confirmar' : open ? 'reimpresion' : 'activa',
  };
}

function mapRef(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    color: row.color,
    size: row.size,
    line: row.line,
    notes: row.notes,
    silhouette: row.silhouette || '',
    material: row.material || '',
    location: row.location || '',
    price: Number(row.price || 0),
    image: row.image ? `/api/media/${row.image}` : '',
    createdAt: row.created_at,
    inStock: Number(row.in_stock || 0),
    priority: Number(row.priority_count || 0),
    out: Number(row.out_count || 0),
    total: Number(row.total_count || 0),
    exits: Number(row.exit_sum || 0),
    returns: Number(row.return_sum || 0),
  };
}

function mapMovement(row) {
  return {
    id: row.id,
    pairId: row.pair_id,
    type: row.type,
    note: row.note,
    createdAt: row.created_at,
    amount: Number(row.amount || 0),
    channel: row.channel || null,
    size: row.pair_size || '',
    qrCode: row.qr_code,
    referenceCode: row.reference_code,
    name: row.reference_name,
  };
}

function mapIncident(row) {
  return {
    id: row.id,
    pairId: row.pair_id,
    description: row.description,
    createdAt: row.created_at,
    reprintedAt: row.reprinted_at,
    qrCode: row.qr_code,
    referenceCode: row.reference_code,
    name: row.reference_name,
    color: row.color,
    size: row.size,
  };
}

const REF_SELECT = `
SELECT r.*,
  COALESCE(SUM(CASE WHEN p.status IN ('inventario', 'prioridad') THEN 1 ELSE 0 END), 0) AS in_stock,
  COALESCE(SUM(CASE WHEN p.status = 'prioridad' THEN 1 ELSE 0 END), 0) AS priority_count,
  COALESCE(SUM(CASE WHEN p.status = 'salida' THEN 1 ELSE 0 END), 0) AS out_count,
  COUNT(p.id) AS total_count,
  COALESCE(SUM(p.exit_count), 0) AS exit_sum,
  COALESCE(SUM(p.return_count), 0) AS return_sum
FROM shoe_refs r
LEFT JOIN pairs p ON p.reference_id = r.id
`;

function getPair(id) {
  return mapPair(db.prepare(`${PAIR_SELECT} WHERE p.id = ?`).get(id));
}

function findPairByScan(raw) {
  const parsed = parseScan(raw);
  if (!parsed) return null;
  const row = db.prepare(`${PAIR_SELECT} WHERE p.qr_code = ? OR p.payload = ?`).get(
    parsed.qrCode,
    parsed.payload,
  );
  return mapPair(row);
}

function nextQr() {
  const row = db.prepare(`SELECT value FROM meta WHERE key = 'next_qr'`).get();
  return canonicalQr(Number(row.value));
}

function bogotaToday() {
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return {
    start: new Date(`${day}T00:00:00-05:00`).toISOString(),
    end: new Date(`${day}T23:59:59.999-05:00`).toISOString(),
  };
}

function channelAccount(channel) {
  const moved = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'salida' THEN amount ELSE 0 END), 0) AS exited,
      COALESCE(SUM(CASE WHEN type = 'devolucion' THEN amount ELSE 0 END), 0) AS returned,
      COALESCE(SUM(CASE WHEN type = 'salida' THEN 1 ELSE 0 END), 0) AS exits,
      COALESCE(SUM(CASE WHEN type = 'devolucion' THEN 1 ELSE 0 END), 0) AS returns
    FROM movements
    WHERE channel = ?
  `).get(channel);
  const paid = Number(db.prepare(`SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE channel = ?`).get(channel).paid);
  const owed = Number(moved.exited) - Number(moved.returned);
  return {
    channel,
    exitedValue: Number(moved.exited),
    returnedValue: Number(moved.returned),
    owed,
    paid,
    balance: owed - paid,
    exits: Number(moved.exits),
    returns: Number(moved.returns),
    outNow: Number(db.prepare(`SELECT COUNT(*) AS n FROM pairs WHERE status = 'salida' AND channel = ?`).get(channel).n),
  };
}

function listPayments(limit = 100) {
  return db.prepare(`
    SELECT id, channel, amount, note, created_at FROM payments
    ORDER BY created_at DESC LIMIT ?
  `).all(limit).map((row) => ({
    id: row.id,
    channel: row.channel,
    amount: Number(row.amount),
    note: row.note,
    createdAt: row.created_at,
  }));
}

function bodegaGrid() {
  const refs = listRefs();
  const stockRows = db.prepare(`
    SELECT reference_id, size,
      SUM(CASE WHEN status IN ('inventario', 'prioridad') THEN 1 ELSE 0 END) AS stock,
      SUM(CASE WHEN status = 'prioridad' THEN 1 ELSE 0 END) AS priority
    FROM pairs
    GROUP BY reference_id, size
  `).all();
  const dates = db.prepare(`
    SELECT reference_id, MAX(created_at) AS last_entry, MAX(exited_at) AS last_exit
    FROM pairs GROUP BY reference_id
  `).all();
  const dateMap = new Map(dates.map((row) => [row.reference_id, row]));
  const stockMap = new Map();
  stockRows.forEach((row) => {
    if (!stockMap.has(row.reference_id)) stockMap.set(row.reference_id, {});
    stockMap.get(row.reference_id)[row.size] = {
      stock: Number(row.stock || 0),
      priority: Number(row.priority || 0),
    };
  });
  const rows = refs.map((ref) => {
    const bySize = stockMap.get(ref.id) || {};
    const stockBySize = {};
    const priorityBySize = {};
    SHOE_SIZES.forEach((size) => {
      stockBySize[size] = bySize[size]?.stock || 0;
      priorityBySize[size] = bySize[size]?.priority || 0;
    });
    const when = dateMap.get(ref.id) || {};
    return {
      ...ref,
      stockBySize,
      priorityBySize,
      lastEntry: when.last_entry || null,
      lastExit: when.last_exit || null,
      stockValue: ref.inStock * ref.price,
    };
  });
  const totals = { bySize: {}, pairs: 0, priority: 0, value: 0 };
  SHOE_SIZES.forEach((size) => { totals.bySize[size] = 0; });
  rows.forEach((row) => {
    totals.pairs += row.inStock;
    totals.priority += row.priority;
    totals.value += row.stockValue;
    SHOE_SIZES.forEach((size) => { totals.bySize[size] += row.stockBySize[size]; });
  });
  return { sizes: SHOE_SIZES, rows, totals };
}

function accountingData() {
  return {
    paginas: channelAccount('paginas'),
    dropi: channelAccount('dropi'),
    payments: listPayments(200),
  };
}

function listRefs() {
  return db.prepare(`${REF_SELECT} GROUP BY r.id ORDER BY r.code ASC`).all().map(mapRef);
}

function totals() {
  const pairs = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN status IN ('inventario', 'prioridad') THEN 1 ELSE 0 END), 0) AS in_stock,
      COALESCE(SUM(CASE WHEN status = 'prioridad' THEN 1 ELSE 0 END), 0) AS priority,
      COALESCE(SUM(CASE WHEN status = 'salida' THEN 1 ELSE 0 END), 0) AS out_count
    FROM pairs
  `).get();
  const today = bogotaToday();
  const movements = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'entrada' THEN 1 ELSE 0 END), 0) AS entries,
      COALESCE(SUM(CASE WHEN type = 'salida' THEN 1 ELSE 0 END), 0) AS exits,
      COALESCE(SUM(CASE WHEN type = 'devolucion' THEN 1 ELSE 0 END), 0) AS returns
    FROM movements
    WHERE created_at >= ? AND created_at <= ?
  `).get(today.start, today.end);
  return {
    references: Number(db.prepare(`SELECT COUNT(*) AS n FROM shoe_refs`).get().n),
    inStock: Number(pairs.in_stock),
    priority: Number(pairs.priority),
    out: Number(pairs.out_count),
    outPaginas: Number(db.prepare(`SELECT COUNT(*) AS n FROM pairs WHERE status = 'salida' AND channel = 'paginas'`).get().n),
    outDropi: Number(db.prepare(`SELECT COUNT(*) AS n FROM pairs WHERE status = 'salida' AND channel = 'dropi'`).get().n),
    warehouseValue: Number(db.prepare(`
      SELECT COALESCE(SUM(r.price), 0) AS value
      FROM pairs p JOIN shoe_refs r ON r.id = p.reference_id
      WHERE p.status IN ('inventario', 'prioridad')
    `).get().value),
    incidentsOpen: Number(db.prepare(`SELECT COUNT(*) AS n FROM incidents WHERE reprinted_at IS NULL`).get().n),
    entriesToday: Number(movements.entries),
    exitsToday: Number(movements.exits),
    returnsToday: Number(movements.returns),
  };
}

function listMovements(limit = 200) {
  return db.prepare(`
    SELECT m.id, m.pair_id, m.type, m.note, m.created_at, m.amount, m.channel,
           p.qr_code, p.size AS pair_size, r.code AS reference_code, r.name AS reference_name
    FROM movements m
    JOIN pairs p ON p.id = m.pair_id
    JOIN shoe_refs r ON r.id = p.reference_id
    ORDER BY m.created_at DESC, m.rowid DESC
    LIMIT ?
  `).all(limit).map(mapMovement);
}

function listIncidents() {
  return db.prepare(`
    SELECT i.id, i.pair_id, i.description, i.created_at, i.reprinted_at,
           p.qr_code, p.size, r.code AS reference_code, r.name AS reference_name, r.color
    FROM incidents i
    JOIN pairs p ON p.id = i.pair_id
    JOIN shoe_refs r ON r.id = p.reference_id
    ORDER BY i.created_at DESC
    LIMIT 500
  `).all().map(mapIncident);
}

function listPairsFiltered(whereSql, params) {
  return db.prepare(`
    ${PAIR_SELECT}
    ${whereSql}
    ORDER BY CASE p.status WHEN 'prioridad' THEN 0 WHEN 'inventario' THEN 1 ELSE 2 END, p.qr_number ASC
  `).all(...params).map(mapPair);
}

export const api = {
  sequence() {
    const row = db.prepare(`SELECT value FROM meta WHERE key = 'next_qr'`).get();
    const nextNumber = Number(row.value);
    return { nextNumber, nextQr: canonicalQr(nextNumber) };
  },

  dashboard() {
    const stats = totals();
    const accounts = accountingData();
    return {
      totals: {
        ...stats,
        paginasBalance: accounts.paginas.balance,
        dropiBalance: accounts.dropi.balance,
        paginasOwed: accounts.paginas.owed,
        dropiOwed: accounts.dropi.owed,
      },
      nextQr: nextQr(),
      byReference: listRefs(),
      priorityPairs: db.prepare(`
        ${PAIR_SELECT}
        WHERE p.status = 'prioridad'
        ORDER BY p.returned_at ASC
        LIMIT 12
      `).all().map(mapPair),
      recentMovements: listMovements(8),
    };
  },

  listReferences() {
    return listRefs();
  },

  createReference(input) {
    const code = cleanCode(input.code);
    const name = requiredText(input.name, 'La descripción', 80);
    const color = requiredText(input.color, 'El color', 40);
    const line = cleanLine(input.line);
    const silhouette = cleanOptional(input.silhouette, 40);
    const material = cleanOptional(input.material, 40);
    const location = cleanOptional(input.location, 24);
    const price = cleanPrice(input.price);
    const notes = cleanOptional(input.notes, 300);
    const image = input.image ? saveImage(input.image) : '';
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    try {
      db.prepare(`
        INSERT INTO shoe_refs (
          id, code, name, color, size, line, notes, silhouette, material, location, price, image, created_at
        ) VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, code, name, color, line, notes, silhouette, material, location, price, image, now);
    } catch (error) {
      if (isUnique(error)) fail(400, 'Ya existe una referencia con ese código.');
      throw error;
    }
    return listRefs().find((item) => item.id === id);
  },

  updateReference(id, input) {
    const current = db.prepare(`SELECT * FROM shoe_refs WHERE id = ?`).get(id);
    if (!current) fail(404, 'La referencia no existe.');
    const code = input.code != null ? cleanCode(input.code) : current.code;
    const name = input.name != null ? requiredText(input.name, 'La descripción', 80) : current.name;
    const color = input.color != null ? requiredText(input.color, 'El color', 40) : current.color;
    const line = input.line != null ? cleanLine(input.line) : current.line;
    const silhouette = input.silhouette != null ? cleanOptional(input.silhouette, 40) : (current.silhouette || '');
    const material = input.material != null ? cleanOptional(input.material, 40) : (current.material || '');
    const location = input.location != null ? cleanOptional(input.location, 24) : (current.location || '');
    const price = input.price != null ? cleanPrice(input.price) : Number(current.price || 0);
    const notes = input.notes != null ? cleanOptional(input.notes, 300) : current.notes;
    const image = keepImage(input.image, current.image);
    try {
      transaction(() => {
        db.prepare(`
          UPDATE shoe_refs
          SET code = ?, name = ?, color = ?, line = ?, notes = ?, silhouette = ?, material = ?, location = ?, price = ?, image = ?
          WHERE id = ?
        `).run(code, name, color, line, notes, silhouette, material, location, price, image, id);
        db.prepare(`
          UPDATE pairs SET payload = qr_code WHERE reference_id = ?
        `).run(id);
      });
    } catch (error) {
      if (isUnique(error)) fail(400, 'Ya existe una referencia con ese código.');
      throw error;
    }
    return listRefs().find((item) => item.id === id);
  },

  deleteReference(id) {
    const current = db.prepare(`SELECT id FROM shoe_refs WHERE id = ?`).get(id);
    if (!current) fail(404, 'La referencia no existe.');
    const count = Number(db.prepare(`SELECT COUNT(*) AS n FROM pairs WHERE reference_id = ?`).get(id).n);
    if (count > 0) {
      fail(400, 'Esta referencia ya tiene pares. Se conserva para no perder el historial.');
    }
    db.prepare(`DELETE FROM shoe_refs WHERE id = ?`).run(id);
    return { ok: true };
  },

  addStock(referenceId, quantities, note) {
    const ref = db.prepare(`SELECT * FROM shoe_refs WHERE id = ?`).get(referenceId);
    if (!ref) fail(404, 'La referencia no existe.');
    const entries = [];
    let total = 0;
    const source = quantities && typeof quantities === 'object' ? quantities : {};
    Object.keys(source).forEach((key) => {
      if (!SHOE_SIZES.includes(String(key)) && Number(source[key])) {
        fail(400, `La talla ${key} no está en la curva del 34 al 45.`);
      }
    });
    SHOE_SIZES.forEach((size) => {
      const qty = Number(source[size] || 0);
      if (!qty) return;
      if (!Number.isInteger(qty) || qty < 0 || qty > 500) {
        fail(400, `La talla ${size} admite de 0 a 500 pares.`);
      }
      entries.push({ size, qty });
      total += qty;
    });
    if (total < 1 || total > 1000) fail(400, 'Ingresa entre 1 y 1000 pares en total.');
    const cleanNote = cleanOptional(note, 300);
    return transaction(() => {
      const start = Number(db.prepare(`SELECT value FROM meta WHERE key = 'next_qr'`).get().value);
      const insertPair = db.prepare(`
        INSERT INTO pairs (
          id, qr_number, qr_code, payload, reference_id, size, status, created_at, exit_count, return_count
        ) VALUES (?, ?, ?, ?, ?, ?, 'inventario', ?, 0, 0)
      `);
      const insertMove = db.prepare(`
        INSERT INTO movements (id, pair_id, type, note, created_at, amount, channel)
        VALUES (?, ?, 'entrada', ?, ?, 0, NULL)
      `);
      const now = new Date().toISOString();
      const ids = [];
      let cursor = start;
      entries.forEach((entry) => {
        for (let offset = 0; offset < entry.qty; offset += 1) {
          const qrNumber = cursor;
          cursor += 1;
          const qrCode = canonicalQr(qrNumber);
          const id = crypto.randomUUID();
          insertPair.run(id, qrNumber, qrCode, qrCode, referenceId, entry.size, now);
          insertMove.run(
            crypto.randomUUID(),
            id,
            cleanNote || `Ingreso talla ${entry.size}, código ${qrCode}.`,
            now,
          );
          ids.push(id);
        }
      });
      db.prepare(`UPDATE meta SET value = ? WHERE key = 'next_qr'`).run(String(cursor));
      return {
        quantity: total,
        from: canonicalQr(start),
        to: canonicalQr(cursor - 1),
        bySize: Object.fromEntries(entries.map((entry) => [entry.size, entry.qty])),
        pairs: ids.map((id) => getPair(id)),
      };
    });
  },

  listPairs(query) {
    const where = [];
    const params = [];
    const status = String(query.status || 'existencia');
    if (status === 'existencia') where.push(`p.status IN ('inventario', 'prioridad')`);
    else if (status === 'paginas') where.push(`p.status = 'salida' AND p.channel = 'paginas'`);
    else if (status === 'dropi') where.push(`p.status = 'salida' AND p.channel = 'dropi'`);
    else if (status !== 'todos') {
      if (!['inventario', 'salida', 'prioridad'].includes(status)) fail(400, 'Estado inválido.');
      where.push('p.status = ?');
      params.push(status);
    }
    if (query.referenceId) {
      where.push('p.reference_id = ?');
      params.push(String(query.referenceId));
    }
    if (query.printable === '1') {
      where.push(`(
        p.printed_at IS NULL OR EXISTS (
          SELECT 1 FROM incidents i WHERE i.pair_id = p.id AND i.reprinted_at IS NULL
        )
      )`);
    }
    const q = String(query.q || '').trim();
    if (q) {
      where.push(`(p.qr_code LIKE ? OR p.payload LIKE ? OR r.code LIKE ? OR r.name LIKE ? OR r.color LIKE ? OR p.size LIKE ?)`);
      const like = `%${q}%`;
      params.push(like, like, like, like, like, like);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const pageSize = Math.min(100, Math.max(10, Number(query.pageSize) || 25));
    const page = Math.max(1, Number(query.page) || 1);
    const total = Number(db.prepare(`
      SELECT COUNT(*) AS n
      FROM pairs p
      JOIN shoe_refs r ON r.id = p.reference_id
      ${whereSql}
    `).get(...params).n);
    const items = db.prepare(`
      ${PAIR_SELECT}
      ${whereSql}
      ORDER BY CASE p.status WHEN 'prioridad' THEN 0 WHEN 'inventario' THEN 1 ELSE 2 END, p.qr_number ASC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, (page - 1) * pageSize).map(mapPair);
    return { items, total, page, pageSize };
  },

  lookup(code) {
    const pair = findPairByScan(code);
    if (!pair) fail(404, 'No encontré un par con ese código de barras.');
    return pair;
  },

  scan(code, mode, channel) {
    if (mode === 'salida' && !['paginas', 'dropi'].includes(channel)) {
      fail(400, 'Indica si la salida es para páginas o para Dropi.');
    }
    if (!['salida', 'devolucion'].includes(mode)) fail(400, 'El modo de escaneo no es válido.');
    return transaction(() => {
      const pair = findPairByScan(code);
      if (!pair) fail(404, 'Ese código no está registrado en el inventario.');
      const now = new Date().toISOString();
      if (mode === 'salida') {
        if (pair.status === 'salida') {
          fail(400, `El par ${pair.qrCode} ya salió para ${channelName(pair.channel)}.`);
        }
        const wasPriority = pair.status === 'prioridad';
        db.prepare(`
          UPDATE pairs
          SET status = 'salida', channel = ?, exited_at = ?, exit_count = exit_count + 1
          WHERE id = ?
        `).run(channel, now, pair.id);
        db.prepare(`
          INSERT INTO movements (id, pair_id, type, note, created_at, amount, channel)
          VALUES (?, ?, 'salida', ?, ?, ?, ?)
        `).run(
          crypto.randomUUID(),
          pair.id,
          wasPriority
            ? `Salida prioritaria para ${channelName(channel)}.`
            : `Salida para ${channelName(channel)}.`,
          now,
          pair.price,
          channel,
        );
        const updated = getPair(pair.id);
        const left = stockLeft(updated.referenceId, updated.size);
        return {
          pair: updated,
          stockLeft: left,
          message: wasPriority
            ? `Salió el prioritario ${updated.qrCode} para ${channelName(channel)}. Se descontó 1 par de la talla ${updated.size}. Quedan ${left} en bodega. Se cargan ${pesos(updated.price)}.`
            : `El par ${updated.qrCode} salió para ${channelName(channel)}. Se descontó 1 par de la talla ${updated.size}. Quedan ${left} en bodega. Se cargan ${pesos(updated.price)}.`,
        };
      }
      if (pair.status !== 'salida') {
        fail(400, pair.status === 'prioridad'
          ? `El par ${pair.qrCode} ya está en inventario como prioritario.`
          : `El par ${pair.qrCode} ya está en inventario.`);
      }
      const last = db.prepare(`
        SELECT amount, channel FROM movements
        WHERE pair_id = ? AND type = 'salida'
        ORDER BY created_at DESC LIMIT 1
      `).get(pair.id);
      const amount = Number(last?.amount || pair.price || 0);
      const backChannel = last?.channel || pair.channel || null;
      db.prepare(`
        UPDATE pairs
        SET status = 'prioridad', channel = NULL, returned_at = ?, return_count = return_count + 1
        WHERE id = ?
      `).run(now, pair.id);
      db.prepare(`
        INSERT INTO movements (id, pair_id, type, note, created_at, amount, channel)
        VALUES (?, ?, 'devolucion', ?, ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        pair.id,
        `Devolución desde ${backChannel ? channelName(backChannel) : 'salida'}. El par vuelve como prioritario.`,
        now,
        amount,
        backChannel,
      );
      const updated = getPair(pair.id);
      const left = stockLeft(updated.referenceId, updated.size);
      return {
        pair: updated,
        stockLeft: left,
        message: `El par ${updated.qrCode} volvió a bodega como prioritario. La talla ${updated.size} queda en ${left}. Se descuentan ${pesos(amount)}${backChannel ? ` de ${channelName(backChannel)}` : ''}.`,
      };
    });
  },

  createIncident(code, description) {
    const text = String(description || '').trim().replace(/\s+/g, ' ');
    if (text.length < 8) fail(400, 'Describe qué pasó con el código. Mínimo 8 caracteres.');
    if (text.length > 500) fail(400, 'La novedad admite máximo 500 caracteres.');
    return transaction(() => {
      const pair = findPairByScan(code);
      if (!pair) fail(404, 'No encontré un par con ese código de barras.');
      const open = db.prepare(`
        SELECT id FROM incidents WHERE pair_id = ? AND reprinted_at IS NULL
      `).get(pair.id);
      if (open) {
        fail(400, `El código ${pair.qrCode} ya tiene una novedad abierta. Puedes reimprimir ese mismo código.`);
      }
      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      db.prepare(`
        INSERT INTO incidents (id, pair_id, description, created_at) VALUES (?, ?, ?, ?)
      `).run(id, pair.id, text, now);
      db.prepare(`
        INSERT INTO movements (id, pair_id, type, note, created_at) VALUES (?, ?, 'novedad', ?, ?)
      `).run(crypto.randomUUID(), pair.id, text, now);
      return {
        pair: getPair(pair.id),
        incident: listIncidents().find((item) => item.id === id),
      };
    });
  },

  listIncidents,

  listMovements,

  checkLabels(pairIds) {
    if (!Array.isArray(pairIds) || pairIds.length === 0) fail(400, 'Selecciona al menos un par.');
    const printable = [];
    const blocked = [];
    pairIds.forEach((id) => {
      const pair = getPair(String(id));
      if (!pair) {
        blocked.push({ id, qrCode: String(id), reason: 'Ese par no existe.' });
        return;
      }
      if (!pair.canPrint) {
        blocked.push({
          id: pair.id,
          qrCode: pair.qrCode,
          reason: `El código ${pair.qrCode} ya fue impreso. Registra la novedad de daño para reimprimir el mismo código.`,
        });
        return;
      }
      printable.push(pair);
    });
    return { printable, blocked };
  },

  confirmLabels(pairIds) {
    if (!Array.isArray(pairIds) || pairIds.length === 0) fail(400, 'Selecciona al menos un par.');
    if (pairIds.length > 300) fail(400, 'Puedes confirmar hasta 300 etiquetas a la vez.');
    return transaction(() => {
      const updated = [];
      pairIds.forEach((id) => {
        const pair = getPair(String(id));
        if (!pair) fail(404, 'Hay un par que ya no existe.');
        const open = db.prepare(`
          SELECT id FROM incidents
          WHERE pair_id = ? AND reprinted_at IS NULL
          ORDER BY created_at ASC
          LIMIT 1
        `).get(pair.id);
        if (pair.printedAt && !open) {
          fail(400, `El código ${pair.qrCode} ya fue impreso. Registra la novedad de daño para volver a imprimir el mismo código.`);
        }
        const now = new Date().toISOString();
        if (open) {
          db.prepare(`UPDATE incidents SET reprinted_at = ? WHERE id = ?`).run(now, open.id);
          db.prepare(`
            INSERT INTO movements (id, pair_id, type, note, created_at) VALUES (?, ?, 'reimpresion', ?, ?)
          `).run(crypto.randomUUID(), pair.id, 'Reimpresión del mismo código autorizada por novedad.', now);
        }
        db.prepare(`UPDATE pairs SET printed_at = ? WHERE id = ?`).run(now, pair.id);
        updated.push(getPair(pair.id));
      });
      return updated;
    });
  },

  reportDataset() {
    const stats = totals();
    const movementCount = Number(db.prepare(`SELECT COUNT(*) AS n FROM movements`).get().n);
    const accounts = accountingData();
    return {
      totals: { ...stats, paginasBalance: accounts.paginas.balance, dropiBalance: accounts.dropi.balance },
      nextQr: nextQr(),
      refs: listRefs(),
      bodega: bodegaGrid(),
      accounting: accounts,
      rotation: listRefs().sort((a, b) => b.exits - a.exits || a.code.localeCompare(b.code)),
      inStockPairs: listPairsFiltered(`WHERE p.status IN ('inventario', 'prioridad')`, []),
      priorityPairs: listPairsFiltered(`WHERE p.status = 'prioridad'`, []),
      outPairs: listPairsFiltered(`WHERE p.status = 'salida'`, []),
      movements: listMovements(5000),
      movementsTruncated: movementCount > 5000,
      incidents: listIncidents(),
    };
  },

  bodega() {
    return bodegaGrid();
  },

  accounting() {
    return accountingData();
  },

  addPayment(channel, amount, note) {
    if (!['paginas', 'dropi'].includes(channel)) fail(400, 'El abono es para páginas o para Dropi.');
    const value = Number(amount);
    if (!Number.isInteger(value) || value < 1 || value > 100000000) {
      fail(400, 'El abono debe ser un entero en pesos, mayor que cero.');
    }
    const text = cleanOptional(note, 300);
    if (text.length < 3) fail(400, 'Escribe una nota del abono. Mínimo 3 caracteres.');
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO payments (id, channel, amount, note, created_at) VALUES (?, ?, ?, ?, ?)`).run(id, channel, value, text, now);
    return accountingData();
  },
};
