import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function writableDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, '.probe');
    fs.writeFileSync(probe, '1');
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

let cachedDataDir = null;

export function dataDir() {
  if (cachedDataDir) return cachedDataDir;
  const candidates = [];
  if (process.env.EVALOOK_DATA) candidates.push(path.resolve(process.env.EVALOOK_DATA));
  const cwd = process.cwd();
  const marker = `${path.sep}hbuilds${path.sep}`;
  const at = cwd.indexOf(marker);
  if (at !== -1) candidates.push(path.join(cwd.slice(0, at), 'evalook-data'));
  candidates.push(path.join(root, 'data'));
  cachedDataDir = candidates.find((dir) => writableDir(dir)) || path.join(root, 'data');
  return cachedDataDir;
}

export function imagesDir() {
  return path.join(dataDir(), 'images');
}

export function dbFilePath() {
  return process.env.EVALOOK_DB || path.join(dataDir(), 'evalook.sqlite');
}

function seedPersistentData(dbPath) {
  if (fs.existsSync(dbPath)) return;
  const persistent = path.join(dataDir(), 'evalook.sqlite');
  if (path.resolve(dbPath) !== path.resolve(persistent)) return;
  const bundled = path.join(root, 'data', 'evalook.sqlite');
  if (!fs.existsSync(bundled) || path.resolve(bundled) === path.resolve(dbPath)) return;
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.copyFileSync(bundled, dbPath);
  const fromImages = path.join(root, 'data', 'images');
  const toImages = imagesDir();
  if (fs.existsSync(fromImages) && !fs.existsSync(toImages)) {
    fs.cpSync(fromImages, toImages, { recursive: true });
  }
}
let database = null;

function addColumn(table, column, definition) {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((item) => item.name === column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function migratePaymentsChannels() {
  const row = database.prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'payments'`).get();
  const sql = String(row?.sql || '');
  if (!sql || sql.includes("'fabrica'")) return;
  database.exec(`
    CREATE TABLE payments_mig (
      id TEXT PRIMARY KEY,
      channel TEXT NOT NULL CHECK (channel IN ('paginas', 'dropi', 'fabrica')),
      amount INTEGER NOT NULL CHECK (amount > 0),
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    INSERT INTO payments_mig (id, channel, amount, note, created_at)
    SELECT id, channel, amount, note, created_at FROM payments;
    DROP TABLE payments;
    ALTER TABLE payments_mig RENAME TO payments;
  `);
}

const schema = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = DELETE;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS shoe_refs (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '',
  size TEXT NOT NULL DEFAULT '',
  line TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pairs (
  id TEXT PRIMARY KEY,
  qr_number INTEGER NOT NULL UNIQUE,
  qr_code TEXT NOT NULL UNIQUE,
  payload TEXT NOT NULL UNIQUE,
  reference_id TEXT NOT NULL REFERENCES shoe_refs(id),
  status TEXT NOT NULL CHECK (status IN ('inventario', 'salida', 'prioridad')),
  created_at TEXT NOT NULL,
  exited_at TEXT,
  returned_at TEXT,
  printed_at TEXT,
  exit_count INTEGER NOT NULL DEFAULT 0,
  return_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS movements (
  id TEXT PRIMARY KEY,
  pair_id TEXT NOT NULL REFERENCES pairs(id),
  type TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  pair_id TEXT NOT NULL REFERENCES pairs(id),
  description TEXT NOT NULL,
  created_at TEXT NOT NULL,
  reprinted_at TEXT
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pairs_status ON pairs(status);
CREATE INDEX IF NOT EXISTS idx_pairs_ref ON pairs(reference_id);
CREATE INDEX IF NOT EXISTS idx_movements_created ON movements(created_at);
CREATE INDEX IF NOT EXISTS idx_incidents_pair ON incidents(pair_id);
`;

export function getDb() {
  if (database) return database;
  const dbPath = dbFilePath();
  seedPersistentData(dbPath);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  database = new DatabaseSync(dbPath);
  database.exec(schema);
  database.exec(`PRAGMA foreign_keys = ON; PRAGMA synchronous = FULL; PRAGMA busy_timeout = 5000;`);
  addColumn('shoe_refs', 'silhouette', `TEXT NOT NULL DEFAULT ''`);
  addColumn('shoe_refs', 'material', `TEXT NOT NULL DEFAULT ''`);
  addColumn('shoe_refs', 'location', `TEXT NOT NULL DEFAULT ''`);
  addColumn('shoe_refs', 'price', `INTEGER NOT NULL DEFAULT 0`);
  addColumn('shoe_refs', 'image', `TEXT NOT NULL DEFAULT ''`);
  addColumn('pairs', 'size', `TEXT NOT NULL DEFAULT ''`);
  addColumn('pairs', 'channel', 'TEXT');
  addColumn('movements', 'amount', `INTEGER NOT NULL DEFAULT 0`);
  addColumn('movements', 'channel', 'TEXT');
  database.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      channel TEXT NOT NULL CHECK (channel IN ('paginas', 'dropi', 'fabrica')),
      amount INTEGER NOT NULL CHECK (amount > 0),
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_pairs_channel ON pairs(channel);
    CREATE INDEX IF NOT EXISTS idx_movements_channel ON movements(channel);
  `);
  migratePaymentsChannels();
  database.exec(`
    UPDATE pairs
    SET size = (
      SELECT size FROM shoe_refs WHERE shoe_refs.id = pairs.reference_id
    )
    WHERE size = ''
  `);
  database.prepare(`INSERT OR IGNORE INTO meta (key, value) VALUES ('next_qr', '1')`).run();
  return database;
}

export function closeDb() {
  if (!database) return;
  database.close();
  database = null;
}
