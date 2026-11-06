import http from 'node:http';

const port = process.env.PORT || 3000;
console.log(`Calzado Evalook arranque node=${process.version} PORT=${process.env.PORT || '(no definido)'}`);

let onRequest = (_req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end('<!doctype html><meta charset="utf-8"><title>Calzado Evalook</title><p>Iniciando inventario…</p>');
};

const server = http.createServer((req, res) => onRequest(req, res));
server.on('error', (error) => {
  console.error(error);
  process.exit(1);
});
server.listen(port, '0.0.0.0', () => {
  console.log(`Calzado Evalook escuchando en el puerto ${port}`);
});

try {
  const loaded = await import('./index.js');
  onRequest = loaded.app;
  console.log('Calzado Evalook listo');
} catch (error) {
  console.error(error);
  const text = String(error?.stack || error);
  onRequest = (_req, res) => {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(text);
  };
}
