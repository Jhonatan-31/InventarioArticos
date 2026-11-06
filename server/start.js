import http from 'node:http';

const port = Number(process.env.PORT || 8787);

function explain(error) {
  console.error(error);
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><meta charset="utf-8"><title>Calzado Evalook</title>
      <body style="font-family:sans-serif;background:#f3ece3;color:#1c1612;padding:48px">
      <h1>Falta ajustar Node</h1>
      <p>Este inventario necesita Node.js 24. En Hostinger pulsa Redistribuir, cambia la versión del nodo a <strong>24.x</strong> y confirma.</p>
      </body>`);
  });
  server.listen(port);
}

try {
  await import('node:sqlite');
  await import('./index.js');
} catch (error) {
  explain(error);
}
