import ExcelJS from 'exceljs';

const INK = 'FF1A1614';
const COGNAC = 'FF6E3220';
const CREAM = 'FFF7F1E8';
const PAPER = 'FFFFFCF8';
const LINE = 'FFE4D9CC';
const MUTED = 'FF6B625A';
const WHITE = 'FFFFF8F3';
const PRIORITY = 'FFF8E6E3';
const OX = 'FF8C2A24';

function formatWhen(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  }).format(date);
}

function excelText(value) {
  if (value == null) return '';
  const text = String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function thin() {
  const border = { style: 'thin', color: { argb: LINE } };
  return { top: border, left: border, bottom: border, right: border };
}

function paintHeader(row) {
  row.height = 22;
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { name: 'Calibri', bold: true, size: 11, color: { argb: WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COGNAC } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    cell.border = thin();
  });
}

function paintBody(row, index, priority) {
  const fill = priority ? PRIORITY : index % 2 === 0 ? CREAM : PAPER;
  row.eachCell({ includeEmpty: true }, (cell, col) => {
    cell.font = { name: 'Calibri', size: 11, color: { argb: INK } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
    cell.border = thin();
    cell.alignment = {
      vertical: 'middle',
      horizontal: row.getCell(col).alignment?.horizontal || 'left',
      wrapText: true,
    };
  });
  row.height = 20;
}

function setupSheet(ws, subtitle, lastCol) {
  ws.mergeCells(1, 1, 1, lastCol);
  ws.getCell('A1').value = 'CALZADO EVALOOK';
  ws.getCell('A1').font = { name: 'Calibri', size: 22, bold: true, color: { argb: INK } };
  ws.getRow(1).height = 30;

  ws.mergeCells(2, 1, 2, lastCol);
  ws.getCell('A2').value = subtitle;
  ws.getCell('A2').font = { name: 'Calibri', size: 13, bold: true, color: { argb: COGNAC } };

  ws.mergeCells(3, 1, 3, lastCol);
  ws.getCell('A3').value = `Generado el ${formatWhen(new Date().toISOString())} · Informe interno de inventario`;
  ws.getCell('A3').font = { name: 'Calibri', size: 10, color: { argb: MUTED } };

  ws.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
    printTitlesRow: '1:5',
    margins: { left: 0.45, right: 0.45, top: 0.55, bottom: 0.55, header: 0.25, footer: 0.25 },
  };
  ws.headerFooter.oddFooter = '&LCalzado Evalook&CInventario de pares&RPágina &P de &N';
  ws.properties.tabColor = { argb: COGNAC };
  ws.views = [{ state: 'frozen', ySplit: 5, showGridLines: false }];
}

function writeTable(ws, columns, records, priorityOf) {
  columns.forEach((column, index) => {
    ws.getColumn(index + 1).width = column.width;
  });
  const header = ws.getRow(5);
  columns.forEach((column, index) => {
    const cell = header.getCell(index + 1);
    cell.value = column.header;
  });
  paintHeader(header);

  if (records.length === 0) {
    const empty = ws.getRow(6);
    empty.getCell(1).value = 'Sin registros';
    for (let i = 2; i <= columns.length; i += 1) empty.getCell(i).value = '';
    paintBody(empty, 0, false);
    ws.mergeCells(6, 1, 6, columns.length);
    return;
  }

  records.forEach((record, index) => {
    const row = ws.getRow(6 + index);
    columns.forEach((column, cellIndex) => {
      const cell = row.getCell(cellIndex + 1);
      const raw = column.value(record);
      cell.value = typeof raw === 'number' ? raw : excelText(raw);
      cell.alignment = { vertical: 'middle', horizontal: column.align || 'left', wrapText: true };
    });
    paintBody(row, index, Boolean(priorityOf?.(record)));
    if (priorityOf?.(record)) {
      row.getCell(1).font = { name: 'Calibri', size: 11, bold: true, color: { argb: OX } };
    }
  });

  ws.autoFilter = {
    from: { row: 5, column: 1 },
    to: { row: 5 + records.length, column: columns.length },
  };
}

const statusLabel = {
  inventario: 'En inventario',
  salida: 'Salió',
  prioridad: 'Devolución',
};

const channelLabel = {
  paginas: 'Páginas',
  dropi: 'Dropi',
  fabrica: 'Fábrica',
};

function channelOf(row) {
  if (row.status === 'salida' && row.channel === 'paginas') return 'Salió a páginas';
  if (row.status === 'salida' && row.channel === 'dropi') return 'Salió a Dropi';
  if (row.status === 'salida' && row.channel === 'fabrica') return 'Salió a fábrica';
  return statusLabel[row.status] || row.status;
}

const movementLabel = {
  entrada: 'Entrada',
  salida: 'Salida',
  devolucion: 'Devolución',
  novedad: 'Novedad',
  reimpresion: 'Reimpresión',
};

const pairColumns = [
  { header: 'Código', width: 12, value: (row) => row.qrCode },
  { header: 'Referencia', width: 16, value: (row) => row.referenceCode },
  { header: 'Modelo', width: 28, value: (row) => row.name },
  { header: 'Color', width: 16, value: (row) => row.color },
  { header: 'Talla', width: 12, value: (row) => row.size },
  { header: 'Línea', width: 14, value: (row) => row.line },
  { header: 'Estado', width: 18, value: (row) => channelOf(row) },
  { header: 'Etiqueta', width: 22, value: (row) => (row.printedAt ? (row.reprintAuthorized ? 'Reimpresión autorizada' : 'Activa') : 'Pendiente de confirmar') },
  { header: 'Ingreso', width: 20, value: (row) => formatWhen(row.createdAt) },
  { header: 'Última salida', width: 20, value: (row) => formatWhen(row.exitedAt) },
  { header: 'Última devolución', width: 22, value: (row) => formatWhen(row.returnedAt) },
  { header: 'Salidas', width: 12, align: 'right', value: (row) => row.exitCount },
  { header: 'Devoluciones', width: 14, align: 'right', value: (row) => row.returnCount },
];

export async function buildWorkbook(data) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Calzado Evalook';
  workbook.company = 'Calzado Evalook';
  workbook.title = 'Informe de inventario';
  workbook.created = new Date();
  workbook.modified = new Date();

  const summary = workbook.addWorksheet('Resumen', { properties: { defaultRowHeight: 18 } });
  setupSheet(summary, 'Resumen ejecutivo de inventario', 6);
  summary.getColumn(1).width = 42;
  summary.getColumn(2).width = 18;
  summary.getColumn(3).width = 18;
  summary.getColumn(4).width = 22;
  summary.getColumn(5).width = 16;
  summary.getColumn(6).width = 16;

  const kpis = [
    ['Referencias creadas', data.totals.references],
    ['Pares en existencia', data.totals.inStock],
    ['Pares prioritarios por devolución', data.totals.priority],
    ['Pares que salieron', data.totals.out],
    ['Entradas de hoy', data.totals.entriesToday],
    ['Salidas de hoy', data.totals.exitsToday],
    ['Devoluciones de hoy', data.totals.returnsToday],
    ['Novedades de código sin reimprimir', data.totals.incidentsOpen],
    ['Valor en bodega', data.totals.warehouseValue],
    ['Saldo páginas', data.totals.paginasBalance],
    ['Saldo Dropi', data.totals.dropiBalance],
    ['Saldo fábrica', data.totals.fabricaBalance],
    ['Siguiente código disponible', data.nextQr],
  ];

  summary.getCell('A5').value = 'Indicador';
  summary.getCell('B5').value = 'Valor';
  paintHeader(summary.getRow(5));
  kpis.forEach((item, index) => {
    const row = summary.getRow(6 + index);
    row.getCell(1).value = item[0];
    row.getCell(2).value = item[1];
    row.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };
    paintBody(row, index, item[0].includes('prioritario') && Number(item[1]) > 0);
    if (item[0].includes('prioritario') && Number(item[1]) > 0) {
      row.getCell(2).font = { name: 'Calibri', size: 12, bold: true, color: { argb: OX } };
    }
  });

  const noteRow = 19;
  summary.mergeCells(noteRow, 1, noteRow, 6);
  summary.getCell(noteRow, 1).value = 'Un par prioritario volvió por devolución. Sigue en inventario y debe salir antes que el resto. El código de barras es único para toda la empresa. El valor de bodega es el precio de cada referencia por los pares en existencia. El saldo de páginas y de Dropi es lo salido, menos devoluciones y menos abonos.';
  summary.getCell(noteRow, 1).alignment = { wrapText: true, vertical: 'middle' };
  summary.getCell(noteRow, 1).font = { name: 'Calibri', size: 11, italic: true, color: { argb: MUTED } };
  summary.getRow(noteRow).height = 36;

  const catalogRow = 21;
  summary.getCell(catalogRow, 1).value = 'Código';
  summary.getCell(catalogRow, 2).value = 'Descripción';
  summary.getCell(catalogRow, 3).value = 'Color';
  summary.getCell(catalogRow, 4).value = 'Precio';
  summary.getCell(catalogRow, 5).value = 'Existencia';
  summary.getCell(catalogRow, 6).value = 'Prioritarios';
  paintHeader(summary.getRow(catalogRow));
  const refs = data.refs.length ? data.refs : [];
  if (refs.length === 0) {
    summary.getCell(catalogRow + 1, 1).value = 'Sin referencias';
    summary.mergeCells(catalogRow + 1, 1, catalogRow + 1, 6);
  } else {
    refs.forEach((ref, index) => {
      const row = summary.getRow(catalogRow + 1 + index);
      row.getCell(1).value = excelText(ref.code);
      row.getCell(2).value = excelText(ref.name);
      row.getCell(3).value = excelText(ref.color);
      row.getCell(4).value = ref.price;
      row.getCell(4).numFmt = '#,##0';
      row.getCell(5).value = ref.inStock;
      row.getCell(6).value = ref.priority;
      row.getCell(5).alignment = { horizontal: 'right' };
      row.getCell(6).alignment = { horizontal: 'right' };
      paintBody(row, index, ref.priority > 0);
    });
    summary.autoFilter = { from: { row: catalogRow, column: 1 }, to: { row: catalogRow + refs.length, column: 6 } };
  }

  const sheets = [
    ['En existencia', 'Pares disponibles, incluidos los prioritarios', data.inStockPairs],
    ['Prioritarios', 'Pares devueltos que deben salir primero', data.priorityPairs],
    ['Salidas', 'Pares que ya no están en inventario', data.outPairs],
  ];
  sheets.forEach(([name, subtitle, rows]) => {
    const ws = workbook.addWorksheet(name, { properties: { defaultRowHeight: 18 } });
    setupSheet(ws, subtitle, pairColumns.length);
    writeTable(ws, pairColumns, rows, (row) => row.status === 'prioridad');
  });

  const references = workbook.addWorksheet('Referencias', { properties: { defaultRowHeight: 18 } });
  const refColumns = [
    { header: 'Código', width: 16, value: (row) => row.code },
    { header: 'Descripción', width: 28, value: (row) => row.name },
    { header: 'Silueta', width: 16, value: (row) => row.silhouette },
    { header: 'Material', width: 16, value: (row) => row.material },
    { header: 'Ubicación', width: 14, value: (row) => row.location },
    { header: 'Color', width: 16, value: (row) => row.color },
    { header: 'Línea', width: 14, value: (row) => row.line },
    { header: 'Precio', width: 14, align: 'right', value: (row) => row.price },
    { header: 'Existencia', width: 14, align: 'right', value: (row) => row.inStock },
    { header: 'Valor', width: 16, align: 'right', value: (row) => row.inStock * row.price },
    { header: 'Prioritarios', width: 14, align: 'right', value: (row) => row.priority },
    { header: 'Salieron', width: 12, align: 'right', value: (row) => row.out },
    { header: 'Histórico', width: 12, align: 'right', value: (row) => row.total },
    { header: 'Notas', width: 36, value: (row) => row.notes },
    { header: 'Creada', width: 20, value: (row) => formatWhen(row.createdAt) },
  ];
  setupSheet(references, 'Catálogo de referencias', refColumns.length);
  writeTable(references, refColumns, data.refs, (row) => row.priority > 0);

  const rotation = workbook.addWorksheet('Rotación', { properties: { defaultRowHeight: 18 } });
  const rotationColumns = [
    { header: 'Código', width: 16, value: (row) => row.code },
    { header: 'Descripción', width: 28, value: (row) => row.name },
    { header: 'Color', width: 16, value: (row) => row.color },
    { header: 'Precio', width: 14, align: 'right', value: (row) => row.price },
    { header: 'Existencia', width: 14, align: 'right', value: (row) => row.inStock },
    { header: 'Salidas acumuladas', width: 20, align: 'right', value: (row) => row.exits },
    { header: 'Devoluciones acumuladas', width: 24, align: 'right', value: (row) => row.returns },
  ];
  setupSheet(rotation, 'Movimiento acumulado por referencia', rotationColumns.length);
  writeTable(rotation, rotationColumns, data.rotation, (row) => row.priority > 0);

  const movements = workbook.addWorksheet('Movimientos', { properties: { defaultRowHeight: 18 } });
  const movementColumns = [
    { header: 'Fecha', width: 22, value: (row) => formatWhen(row.createdAt) },
    { header: 'Tipo', width: 16, value: (row) => movementLabel[row.type] || row.type },
    { header: 'Código', width: 12, value: (row) => row.qrCode },
    { header: 'Referencia', width: 16, value: (row) => row.referenceCode },
    { header: 'Modelo', width: 28, value: (row) => row.name },
    { header: 'Canal', width: 14, value: (row) => channelLabel[row.channel] || '' },
    { header: 'Valor', width: 14, align: 'right', value: (row) => row.amount || 0 },
    { header: 'Detalle', width: 56, value: (row) => row.note },
  ];
  setupSheet(movements, data.movementsTruncated ? 'Últimos 5000 movimientos' : 'Historial de entradas, salidas, devoluciones y novedades', movementColumns.length);
  writeTable(movements, movementColumns, data.movements, (row) => row.type === 'devolucion');

  const incidents = workbook.addWorksheet('Novedades', { properties: { defaultRowHeight: 18 } });
  const incidentColumns = [
    { header: 'Fecha', width: 22, value: (row) => formatWhen(row.createdAt) },
    { header: 'Código', width: 12, value: (row) => row.qrCode },
    { header: 'Referencia', width: 16, value: (row) => row.referenceCode },
    { header: 'Modelo', width: 28, value: (row) => row.name },
    { header: 'Color', width: 16, value: (row) => row.color },
    { header: 'Talla', width: 12, value: (row) => row.size },
    { header: 'Qué pasó', width: 56, value: (row) => row.description },
    { header: 'Reimpreso', width: 22, value: (row) => (row.reprintedAt ? formatWhen(row.reprintedAt) : 'Pendiente') },
  ];
  setupSheet(incidents, 'Novedades de código dañado', incidentColumns.length);
  writeTable(incidents, incidentColumns, data.incidents, (row) => !row.reprintedAt);

  const bodega = workbook.addWorksheet('Bodega', { properties: { defaultRowHeight: 18 } });
  const sizes = data.bodega?.sizes || [];
  const bodegaColumns = [
    { header: 'Referencia', width: 16 },
    { header: 'Descripción', width: 28 },
    { header: 'Silueta', width: 16 },
    { header: 'Material', width: 16 },
    { header: 'Ubicación', width: 14 },
    { header: 'Color', width: 14 },
    { header: 'Precio', width: 14 },
    { header: 'F. últ. ent', width: 20 },
    { header: 'F. últ. sal', width: 20 },
    { header: 'Prio', width: 10 },
    { header: 'Total', width: 10 },
    { header: 'Valor', width: 16 },
    ...sizes.map((size) => ({ header: size, width: 8 })),
  ];
  setupSheet(bodega, 'Existencia por referencia, color y talla', bodegaColumns.length);
  writeTable(
    bodega,
    bodegaColumns.map((column, index) => ({
      ...column,
      align: index >= 6 ? 'right' : 'left',
      value: (row) => {
        if (index === 0) return row.code;
        if (index === 1) return row.name;
        if (index === 2) return row.silhouette;
        if (index === 3) return row.material;
        if (index === 4) return row.location;
        if (index === 5) return row.color;
        if (index === 6) return row.price;
        if (index === 7) return formatWhen(row.lastEntry);
        if (index === 8) return formatWhen(row.lastExit);
        if (index === 9) return row.priority;
        if (index === 10) return row.inStock;
        if (index === 11) return row.stockValue;
        return row.stockBySize?.[sizes[index - 12]] || 0;
      },
    })),
    data.bodega?.rows || [],
    (row) => row.priority > 0,
  );

  const accounts = workbook.addWorksheet('Contabilidad', { properties: { defaultRowHeight: 18 } });
  const accountColumns = [
    { header: 'Canal', width: 16, value: (row) => channelLabel[row.channel] || row.channel },
    { header: 'Pares fuera', width: 14, align: 'right', value: (row) => row.outNow },
    { header: 'Valor salido', width: 16, align: 'right', value: (row) => row.exitedValue },
    { header: 'Devoluciones', width: 16, align: 'right', value: (row) => row.returnedValue },
    { header: 'Por cobrar', width: 16, align: 'right', value: (row) => row.owed },
    { header: 'Abonos', width: 16, align: 'right', value: (row) => row.paid },
    { header: 'Saldo', width: 16, align: 'right', value: (row) => row.balance },
  ];
  setupSheet(accounts, 'Lo que se debe por páginas, Dropi y fábrica', accountColumns.length);
  writeTable(accounts, accountColumns, [data.accounting.paginas, data.accounting.dropi, data.accounting.fabrica], () => false);

  const payments = workbook.addWorksheet('Abonos', { properties: { defaultRowHeight: 18 } });
  const paymentColumns = [
    { header: 'Fecha', width: 22, value: (row) => formatWhen(row.createdAt) },
    { header: 'Canal', width: 16, value: (row) => channelLabel[row.channel] || row.channel },
    { header: 'Abono', width: 16, align: 'right', value: (row) => row.amount },
    { header: 'Nota', width: 48, value: (row) => row.note },
  ];
  setupSheet(payments, 'Abonos registrados a páginas, Dropi y fábrica', paymentColumns.length);
  writeTable(payments, paymentColumns, data.accounting.payments, () => false);

  workbook.views = [{ activeTab: 0 }];
  return workbook.xlsx.writeBuffer();
}
