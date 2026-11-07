import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { api } from './service.js';
import { buildWorkbook } from './excel.js';
import { authGate, clearSessionCookie, login, sessionStatus, setSessionCookie } from './auth.js';
import { dbFilePath, imagesDir } from './db.js';

export const app = express();
app.use(cors());
app.use(express.json({ limit: '4mb' }));

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, company: 'Calzado Evalook' });
});

app.get('/api/session', (req, res) => {
  res.json(sessionStatus(req));
});

app.post('/api/login', (req, res) => {
  try {
    setSessionCookie(res, login(req.body?.password, req), req);
    res.json({ ok: true });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ error: error.message });
  }
});

app.post('/api/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.use(authGate);

app.get('/api/sequence', (_req, res) => {
  res.json(api.sequence());
});

app.get('/api/dashboard', (_req, res) => {
  res.json(api.dashboard());
});

app.get('/api/references', (_req, res) => {
  res.json(api.listReferences());
});

app.post('/api/references', (req, res) => {
  res.status(201).json(api.createReference(req.body || {}));
});

app.patch('/api/references/:id', (req, res) => {
  res.json(api.updateReference(req.params.id, req.body || {}));
});

app.delete('/api/references/:id', (req, res) => {
  res.json(api.deleteReference(req.params.id));
});

app.post('/api/references/:id/pairs', (req, res) => {
  const body = req.body || {};
  res.status(201).json(api.addStock(req.params.id, body.quantities, body.note));
});

app.get('/api/bodega', (_req, res) => {
  res.json(api.bodega());
});

app.get('/api/accounting', (_req, res) => {
  res.json(api.accounting());
});

app.post('/api/payments', (req, res) => {
  const body = req.body || {};
  res.status(201).json(api.addPayment(body.channel, body.amount, body.note));
});

app.get('/api/media/:file', (req, res) => {
  const file = String(req.params.file || '');
  if (!/^[a-z0-9-]+\.(jpg|png|webp)$/i.test(file)) {
    res.status(404).json({ error: 'Imagen no encontrada.' });
    return;
  }
  res.sendFile(path.join(imagesDir(), file), (error) => {
    if (error && !res.headersSent) res.status(404).json({ error: 'Imagen no encontrada.' });
  });
});

app.get('/api/pairs', (req, res) => {
  res.json(api.listPairs(req.query || {}));
});

app.get('/api/pairs/lookup', (req, res) => {
  res.json(api.lookup(req.query.code));
});

app.post('/api/scan', (req, res) => {
  const body = req.body || {};
  res.json(api.scan(body.code, body.mode, body.channel));
});

app.get('/api/incidents', (_req, res) => {
  res.json(api.listIncidents());
});

app.post('/api/incidents', (req, res) => {
  const body = req.body || {};
  res.status(201).json(api.createIncident(body.code, body.description));
});

app.get('/api/movements', (req, res) => {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
  res.json(api.listMovements(limit));
});

app.post('/api/labels/check', (req, res) => {
  res.json(api.checkLabels((req.body || {}).pairIds));
});

app.post('/api/labels/confirm', (req, res) => {
  res.json(api.confirmLabels((req.body || {}).pairIds));
});

app.get('/api/reports/excel', asyncRoute(async (_req, res) => {
  const buffer = await buildWorkbook(api.reportDataset());
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const filename = `Calzado-Evalook-Inventario-${day}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(Buffer.from(buffer));
}));

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(dist, 'index.html'));
  });
}

app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    res.status(404).json({ error: 'No encontrado.' });
    return;
  }
  res.status(404).end();
});

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  if (status === 500) console.error(error);
  res.status(status).json({
    error: status === 500 ? 'No se pudo completar la operación.' : error.message,
  });
});

const launchedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (launchedDirectly) {
  const port = process.env.PORT || 8787;
  const server = app.listen(port, () => {
    console.log(`Calzado Evalook escuchando en el puerto ${port}`);
    console.log(`Base de datos local: ${dbFilePath()}`);
  });
  server.on('error', (error) => {
    console.error(error.message);
    process.exit(1);
  });
}
