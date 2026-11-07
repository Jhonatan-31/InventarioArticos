import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const file = path.join(os.tmpdir(), `evalook-${Date.now()}.sqlite`);
process.env.EVALOOK_DB = file;

const { api } = await import('./service.js');
const { closeDb } = await import('./db.js');
const { buildWorkbook } = await import('./excel.js');

function assert(condition, message) {
  if (!condition) {
    console.error('FAIL', message);
    process.exitCode = 1;
    throw new Error(message);
  }
  console.log('OK', message);
}

try {
  const oxford = api.createReference({
    code: 'ox-40',
    name: 'Oxford clásico',
    color: 'Miel',
    line: 'Caballero',
    price: 80000,
    silhouette: 'Oxford',
    material: 'Cuero',
    location: 'A-06',
    notes: 'Punta fina',
  });
  const first = api.addStock(oxford.id, { 40: 2, 41: 1 }, 'Factura 10');
  assert(first.from === '00001' && first.to === '00003' && first.quantity === 3, 'el ingreso por talla usa 00001 a 00003');
  assert(first.pairs[0].payload === '00001' && first.pairs[0].size === '40', 'el código de barras es el número y conserva la talla');

  const mocasin = api.createReference({
    code: 'MO-37',
    name: 'Mocasín',
    color: 'Negro',
    line: 'Dama',
    price: 70000,
  });
  const second = api.addStock(mocasin.id, { 37: 1 }, '');
  assert(second.from === '00004' && second.to === '00004', 'el consecutivo sigue en 00004 en otra referencia');
  assert(second.pairs[0].payload === '00004', 'el código nuevo es el número, sin texto extra');

  let blocked = false;
  try { api.scan('00001', 'salida'); } catch { blocked = true; }
  assert(blocked, 'una salida exige el canal páginas, Dropi o fábrica');

  const pages = api.scan('EVALOOK|00001|OX-40', 'salida', 'paginas');
  assert(pages.pair.status === 'salida' && pages.pair.channel === 'paginas', 'la salida a páginas marca el canal');
  assert(pages.stockLeft === 1, 'la salida descuenta el par de la bodega y deja 1 en la talla 40');
  const dropi = api.scan('00002', 'salida', 'dropi');
  assert(dropi.pair.channel === 'dropi' && dropi.message.includes('Dropi'), 'la salida a Dropi queda aparte');
  const factory = api.scan('00004', 'salida', 'fabrica');
  assert(factory.pair.channel === 'fabrica' && factory.message.includes('fábrica'), 'la salida a fábrica queda aparte');

  const oxfordView = api.getReference(oxford.id);
  assert(oxfordView.code === 'OX-40' && oxfordView.inStock === 1, 'la referencia muestra solo lo que sigue en bodega');
  const oxfordStock = api.listPairs({ referenceId: oxford.id, status: 'existencia', pageSize: '50' });
  assert(oxfordStock.total === 1 && !oxfordStock.items.some((item) => item.status === 'salida'), 'al mirar la referencia no aparecen los códigos que ya salieron');

  let accounts = api.accounting();
  assert(
    accounts.paginas.balance === 80000 && accounts.dropi.balance === 80000 && accounts.fabrica.balance === 70000,
    'cada canal debe el precio del par que salió',
  );

  api.addPayment('paginas', 30000, 'Abono transferencia');
  accounts = api.accounting();
  assert(accounts.paginas.paid === 30000 && accounts.paginas.balance === 50000, 'el abono baja el saldo de páginas');

  blocked = false;
  try { api.scan('00001', 'salida', 'paginas'); } catch { blocked = true; }
  assert(blocked, 'un par que ya salió no vuelve a salir');

  const returned = api.scan('1', 'devolucion');
  assert(returned.pair.status === 'prioridad' && returned.pair.channel == null, 'la devolución entra como prioritario y libera el canal');
  accounts = api.accounting();
  assert(accounts.paginas.balance === -30000, 'la devolución reversa el cargo y el abono queda a favor');

  blocked = false;
  try { api.scan('00001', 'devolucion'); } catch { blocked = true; }
  assert(blocked, 'un prioritario no se devuelve otra vez');

  const leftAgain = api.scan('00001', 'salida', 'paginas');
  assert(leftAgain.pair.status === 'salida' && leftAgain.message.includes('prioritario'), 'el prioritario puede salir');
  const backAgain = api.scan('00001', 'devolucion');
  assert(backAgain.pair.status === 'prioridad', 'puede devolverse de nuevo como prioritario');
  accounts = api.accounting();
  assert(
    accounts.paginas.balance === -30000 && accounts.dropi.balance === 80000 && accounts.fabrica.balance === 70000,
    'Dropi y fábrica no se mezclan con el saldo de páginas',
  );

  api.confirmLabels([backAgain.pair.id]);
  blocked = false;
  try { api.confirmLabels([backAgain.pair.id]); } catch { blocked = true; }
  assert(blocked, 'no reimprime el mismo código sin novedad');

  const incident = api.createIncident('00001', 'La etiqueta se mojó en bodega');
  assert(incident.pair.canPrint === true, 'la novedad autoriza reimprimir el mismo código');
  api.confirmLabels([backAgain.pair.id]);
  const after = api.lookup('00001');
  assert(after.canPrint === false && after.qrCode === '00001', 'sigue siendo el mismo código y queda cerrado');

  const stock = api.listPairs({ status: 'prioridad', q: '00001' });
  assert(stock.items.length === 1 && stock.items[0].status === 'prioridad', 'el inventario muestra el prioritario');

  const grid = api.bodega();
  const oxfordRow = grid.rows.find((row) => row.code === 'OX-40');
  assert(oxfordRow.stockBySize['40'] === 1 && oxfordRow.stockBySize['41'] === 1, 'la bodega suma un par por talla 40 y 41');
  assert(oxfordRow.inStock === 2 && oxfordRow.stockValue === 160000, 'el valor de la referencia es precio por existencia');
  assert(grid.totals.pairs === 2 && grid.totals.value === 160000, 'el total de bodega suma las referencias con existencia');

  const buffer = Buffer.from(await buildWorkbook(api.reportDataset()));
  assert(buffer.subarray(0, 2).toString() === 'PK', 'el informe Excel es un archivo válido');

  const moreStock = api.addStock(oxford.id, { 40: 2 }, 'Factura 11');
  assert(moreStock.from === '00005' && moreStock.to === '00006', 'un ingreso nuevo no reutiliza códigos que ya existían');

  const saved = new DatabaseSync(file, { readOnly: true });
  const onDisk = Number(saved.prepare(`SELECT COUNT(*) AS n FROM pairs`).get().n);
  const stockOnDisk = Number(saved.prepare(`SELECT COUNT(*) AS n FROM pairs WHERE status IN ('inventario', 'prioridad')`).get().n);
  saved.close();
  assert(onDisk === 6 && stockOnDisk === 4, 'los pares quedan guardados en el archivo SQL local');
  console.log('ALL PASSED');
} finally {
  closeDb();
  fs.rmSync(file, { force: true });
}
