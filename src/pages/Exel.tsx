import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createExcelOrder,
  deleteExcelOrder,
  excelScan,
  getExcelData,
  updateExcelOrder,
} from '../api';
import { channelLabel, formatMoney } from '../format';
import type { ExcelModuleData, ExcelOrder, ExcelSheet, ExcelShipStatus } from '../types';
import { useUi } from '../ui';
import { PageHeader } from '../components/PageHeader';
import { StatusPill } from '../components/StatusPill';

type FormState = {
  guideNumber: string;
  firstName: string;
  lastName: string;
  transport: string;
  advisor: string;
  shipStatus: ExcelShipStatus;
  costPrice: string;
  salePrice: string;
  shippingPrice: string;
  orderDate: string;
  pairId: string;
  linkedCode: string;
};

function todayBogota() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
}

function emptyForm(): FormState {
  return {
    guideNumber: '',
    firstName: '',
    lastName: '',
    transport: '',
    advisor: '',
    shipStatus: 'Enviado',
    costPrice: '',
    salePrice: '',
    shippingPrice: '',
    orderDate: todayBogota(),
    pairId: '',
    linkedCode: '',
  };
}

function moneyNumber(value: string) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits ? Number(digits) : 0;
}

function ShipStatusPill({ status }: { status: ExcelShipStatus }) {
  const klass = status === 'Devolución'
    ? 'ship-devolucion'
    : status === 'Problema'
      ? 'ship-problema'
      : status === 'Entregado'
        ? 'ship-entregado'
        : 'ship-enviado';
  return <span className={`pill ${klass}`}>{status}</span>;
}

export function Exel() {
  const { bump, notify } = useUi();
  const [sheet, setSheet] = useState<ExcelSheet>('Dropi');
  const [data, setData] = useState<ExcelModuleData | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scanCode, setScanCode] = useState('');
  const [scanNote, setScanNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const scanRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancel = false;
    getExcelData(sheet)
      .then((next) => { if (!cancel) setData(next); })
      .catch((caught: unknown) => {
        if (!cancel) setError(caught instanceof Error ? caught.message : 'No se pudo cargar Exel.');
      });
    return () => { cancel = true; };
  }, [sheet]);

  useEffect(() => { scanRef.current?.focus(); }, [sheet, scanNote]);

  const profitPreview = useMemo(() => {
    return moneyNumber(form.salePrice) - moneyNumber(form.costPrice) - moneyNumber(form.shippingPrice);
  }, [form.salePrice, form.costPrice, form.shippingPrice]);

  const filteredOrders = useMemo(() => {
    const rows = data?.summary.orders || [];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => (
      `${row.guideNumber} ${row.firstName} ${row.lastName} ${row.transport} ${row.advisor} ${row.qrCode || ''} ${row.shipStatus}`
        .toLowerCase()
        .includes(q)
    ));
  }, [data, query]);

  function applyPerson(personId: string) {
    const person = data?.people.find((item) => item.id === personId);
    if (!person) return;
    setForm((current) => ({
      ...current,
      firstName: person.firstName,
      lastName: person.lastName,
      transport: person.transport || current.transport,
      advisor: person.advisor || current.advisor,
    }));
  }

  function loadOrder(order: ExcelOrder) {
    setEditingId(order.id);
    setForm({
      guideNumber: order.guideNumber,
      firstName: order.firstName,
      lastName: order.lastName,
      transport: order.transport,
      advisor: order.advisor,
      shipStatus: order.shipStatus,
      costPrice: String(order.costPrice || ''),
      salePrice: String(order.salePrice || ''),
      shippingPrice: String(order.shippingPrice || ''),
      orderDate: order.orderDate,
      pairId: order.pairId || '',
      linkedCode: order.qrCode || '',
    });
    setScanNote(order.qrCode ? `Editando pedido vinculado a ${order.qrCode}.` : 'Editando pedido.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm());
    setScanNote('');
    setScanCode('');
    scanRef.current?.focus();
  }

  async function handleScan(raw?: string) {
    const code = String(raw ?? scanCode).trim();
    if (!code) return;
    setBusy(true);
    setError('');
    try {
      const result = await excelScan(code, sheet);
      setForm((current) => ({
        ...current,
        guideNumber: result.suggested.guideNumber || current.guideNumber,
        firstName: result.suggested.firstName || current.firstName,
        lastName: result.suggested.lastName || current.lastName,
        transport: result.suggested.transport || current.transport,
        advisor: result.suggested.advisor || current.advisor,
        shipStatus: result.suggested.shipStatus,
        costPrice: String(result.suggested.costPrice || current.costPrice || ''),
        salePrice: String(result.suggested.salePrice || ''),
        shippingPrice: String(result.suggested.shippingPrice || current.shippingPrice || ''),
        orderDate: result.suggested.orderDate,
        pairId: result.suggested.pairId,
        linkedCode: result.pair.qrCode,
      }));
      setScanNote(result.suggested.message);
      notify(result.suggested.message, 'ok');
      if (!result.suggested.channelMatch && result.pair.channel) {
        notify(`El par salió por ${channelLabel[result.pair.channel]}, y esta hoja suele mapear a ${channelLabel[result.suggested.channelHint]}.`, 'info');
      }
      setScanCode('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo leer el código.');
    } finally {
      setBusy(false);
      scanRef.current?.focus();
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = {
        sheet,
        guideNumber: form.guideNumber,
        firstName: form.firstName,
        lastName: form.lastName,
        transport: form.transport,
        advisor: form.advisor,
        shipStatus: form.shipStatus,
        costPrice: moneyNumber(form.costPrice),
        salePrice: moneyNumber(form.salePrice),
        shippingPrice: moneyNumber(form.shippingPrice),
        orderDate: form.orderDate,
        pairId: form.pairId || null,
      };
      const next = editingId
        ? await updateExcelOrder(editingId, payload)
        : await createExcelOrder(payload);
      setData(next);
      bump();
      notify(editingId ? 'Pedido actualizado en Exel.' : 'Pedido digitalizado en Exel.', 'ok');
      resetForm();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar el pedido.');
    } finally {
      setBusy(false);
    }
  }

  async function removeOrder(order: ExcelOrder) {
    if (!window.confirm(`¿Eliminar el pedido de ${order.firstName} ${order.lastName}?`)) return;
    setBusy(true);
    setError('');
    try {
      const next = await deleteExcelOrder(order.id);
      setData(next);
      if (editingId === order.id) resetForm();
      bump();
      notify('Pedido eliminado de Exel.', 'ok');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo eliminar.');
    } finally {
      setBusy(false);
    }
  }

  const channel = data?.sheetChannel[sheet];

  return (
    <div className="stack page exel-page">
      <PageHeader
        eyebrow="Cuentas"
        title="Exel"
        text="Digitaliza pedidos como en Contabilidad_zapatos.xlsx (Dropi, Articos y Evalook). Escanea el par para traer precio y, si ya existe, los datos de la persona."
      />

      <div className="filter-ranges exel-sheets" role="tablist" aria-label="Hojas del Excel">
        {(data?.sheets || ['Dropi', 'Articos', 'Evalook']).map((name) => (
          <button
            key={name}
            type="button"
            className={`channel-${data?.sheetChannel[name] || ''} ${sheet === name ? 'active' : ''}`}
            onClick={() => { setSheet(name); resetForm(); setError(''); }}
          >
            {name}
          </button>
        ))}
      </div>

      {channel && (
        <p className="mode-note">
          Hoja <strong>{sheet}</strong> · se acomoda con el canal de inventario <strong>{channelLabel[channel]}</strong>.
          El escaneo aquí no saca ni devuelve pares: solo trae datos para digitalizar.
        </p>
      )}

      {error && <p className="form-error">{error}</p>}

      {data && (
        <section className="accounts-grid exel-kpis">
          <article className={`panel account-card ${channel}`}>
            <header className="panel-head"><h2>Pedidos</h2><span>{data.summary.count}</span></header>
            <p className="muted">Registros en {sheet}</p>
          </article>
          <article className={`panel account-card ${channel}`}>
            <header className="panel-head"><h2>Total ganancias</h2></header>
            <p className="exel-total">{formatMoney(data.summary.totalProfit)}</p>
            <p className="muted">Venta − fabricación − envío</p>
          </article>
          <article className="panel">
            <header className="panel-head"><h2>Estados</h2></header>
            <div className="exel-status-row">
              {data.shipStatuses.map((status) => (
                <div key={status}>
                  <ShipStatusPill status={status} />
                  <strong>{data.summary.byStatus[status] || 0}</strong>
                </div>
              ))}
            </div>
          </article>
        </section>
      )}

      <section className="split scanner-grid">
        <article className="panel">
          <header className="panel-head">
            <h2>{editingId ? 'Editar pedido' : 'Digitalizar pedido'}</h2>
            {form.linkedCode && <StatusPill status="salida" channel={channel} />}
          </header>

          <form
            className="form-grid"
            onSubmit={(event) => { event.preventDefault(); void handleScan(); }}
          >
            <label className="field">
              <span>Escanear par</span>
              <input
                ref={scanRef}
                value={scanCode}
                onChange={(event) => setScanCode(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  void handleScan(scanCode);
                }}
                placeholder="Pistola o código del par"
                autoComplete="off"
                disabled={busy}
              />
            </label>
            <div className="form-actions">
              <button className="btn primary" type="submit" disabled={busy}>
                Traer datos
              </button>
            </div>
          </form>
          {scanNote && <p className="scan-result ok compact-note"><span>{scanNote}</span></p>}
          {form.linkedCode && (
            <p className="muted">
              Par vinculado: <strong>{form.linkedCode}</strong>
            </p>
          )}

          <form className="form-grid" onSubmit={submit}>
            {!!data?.people.length && (
              <label className="field">
                <span>Persona guardada</span>
                <select defaultValue="" onChange={(event) => applyPerson(event.target.value)}>
                  <option value="">Elegir para rellenar nombre…</option>
                  {data.people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.firstName} {person.lastName}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="field">
              <span>Número de guía</span>
              <input value={form.guideNumber} onChange={(event) => setForm({ ...form, guideNumber: event.target.value })} placeholder="Guía o tracking" />
            </label>
            <label className="field">
              <span>Nombres</span>
              <input value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required />
            </label>
            <label className="field">
              <span>Apellidos</span>
              <input value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required />
            </label>
            <label className="field">
              <span>Transportadora</span>
              <input value={form.transport} onChange={(event) => setForm({ ...form, transport: event.target.value })} placeholder="Interrapidisimo, Servientrega…" />
            </label>
            <label className="field">
              <span>Asesora</span>
              <input value={form.advisor} onChange={(event) => setForm({ ...form, advisor: event.target.value })} />
            </label>
            <label className="field">
              <span>Estado de envío</span>
              <select value={form.shipStatus} onChange={(event) => setForm({ ...form, shipStatus: event.target.value as ExcelShipStatus })}>
                {(data?.shipStatuses || ['Enviado', 'Problema', 'Devolución', 'Entregado']).map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Precio fabricación</span>
              <input inputMode="numeric" value={form.costPrice} onChange={(event) => setForm({ ...form, costPrice: event.target.value.replace(/\D/g, '') })} placeholder="0" />
            </label>
            <label className="field">
              <span>Precio venta</span>
              <input inputMode="numeric" value={form.salePrice} onChange={(event) => setForm({ ...form, salePrice: event.target.value.replace(/\D/g, '') })} placeholder="0" required />
            </label>
            <label className="field">
              <span>Precio de envío</span>
              <input inputMode="numeric" value={form.shippingPrice} onChange={(event) => setForm({ ...form, shippingPrice: event.target.value.replace(/\D/g, '') })} placeholder="0" />
            </label>
            <label className="field">
              <span>Fecha</span>
              <input type="date" value={form.orderDate} onChange={(event) => setForm({ ...form, orderDate: event.target.value })} required />
            </label>
            <label className="field">
              <span>Ganancia por pedido</span>
              <input value={formatMoney(profitPreview)} readOnly />
            </label>
            <div className="form-actions">
              <button className="btn primary" type="submit" disabled={busy}>
                {busy ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Guardar pedido'}
              </button>
              {editingId && (
                <button className="btn ghost" type="button" onClick={resetForm} disabled={busy}>
                  Cancelar edición
                </button>
              )}
            </div>
          </form>
        </article>

        <article className="panel">
          <header className="panel-head">
            <h2>Registros · {sheet}</h2>
            <span>{filteredOrders.length}</span>
          </header>
          <label className="field">
            <span>Buscar</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, guía, código…" />
          </label>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Guía</th>
                  <th>Persona</th>
                  <th>Estado</th>
                  <th>Venta</th>
                  <th>Ganancia</th>
                  <th>Fecha</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {!filteredOrders.length && (
                  <tr><td colSpan={8}>Todavía no hay pedidos digitalizados en {sheet}.</td></tr>
                )}
                {filteredOrders.map((order, index) => (
                  <tr key={order.id} className={index % 2 ? 'exel-alt' : undefined}>
                    <td>{order.qrCode || order.id.slice(0, 8)}</td>
                    <td>{order.guideNumber || '—'}</td>
                    <td>
                      <strong>{order.firstName} {order.lastName}</strong>
                      <div className="muted">{[order.transport, order.advisor].filter(Boolean).join(' · ') || 'Sin transportadora'}</div>
                    </td>
                    <td><ShipStatusPill status={order.shipStatus} /></td>
                    <td className="money">{formatMoney(order.salePrice)}</td>
                    <td className="money">{formatMoney(order.profit)}</td>
                    <td>{order.orderDate}</td>
                    <td>
                      <div className="row-actions">
                        <button type="button" className="btn ghost" onClick={() => loadOrder(order)}>Editar</button>
                        <button type="button" className="btn danger" onClick={() => void removeOrder(order)} disabled={busy}>Borrar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data && (
            <p className="exel-foot">
              Total de ganancias en {sheet}: <strong>{formatMoney(data.summary.totalProfit)}</strong>
            </p>
          )}
        </article>
      </section>
    </div>
  );
}
