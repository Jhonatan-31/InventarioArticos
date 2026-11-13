import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createExcelOrder,
  deleteExcelOrder,
  excelScan,
  getExcelData,
  updateExcelOrder,
} from '../api';
import {
  DATE_RANGE_OPTIONS,
  type DateRangeKey,
  handleDateFilterEnterKey,
  resolveDateRange,
  resolveMonthRange,
} from '../dateFilterEnter';
import { channelLabel, formatMoney } from '../format';
import type { ExcelModuleData, ExcelOrder, ExcelSheet, ExcelShipStatus } from '../types';
import { useUi } from '../ui';
import { PageHeader } from '../components/PageHeader';
import { StatusPill } from '../components/StatusPill';

const TRANSPORTS = ['Interrapidisimo', 'Coordinadora', 'Envia', 'TCC'] as const;
type Transport = (typeof TRANSPORTS)[number];

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
  personPick: string;
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
    personPick: '',
  };
}

function moneyNumber(value: string) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits ? Number(digits) : 0;
}

function normalizeTransport(value: string) {
  const text = String(value || '').trim();
  if (!text) return '';
  const hit = TRANSPORTS.find((item) => item.toLowerCase() === text.toLowerCase());
  return hit || '';
}

function orderProfit(cost: number, sale: number, shipping: number, status: ExcelShipStatus) {
  if (status === 'Devolución') return -shipping;
  return sale - cost - shipping;
}

function shipStatusClass(status: ExcelShipStatus) {
  if (status === 'Devolución') return 'ship-devolucion';
  if (status === 'Problema') return 'ship-problema';
  if (status === 'Entregado') return 'ship-entregado';
  return 'ship-enviado';
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
  const [advisorFilter, setAdvisorFilter] = useState('');
  const [transportFilter, setTransportFilter] = useState('');
  const [dateRange, setDateRange] = useState<DateRangeKey>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo, setAppliedTo] = useState('');
  const [monthPick, setMonthPick] = useState('');
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);
  const dateEnterRef = useRef(0);

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

  const profitPreview = useMemo(() => (
    orderProfit(
      moneyNumber(form.costPrice),
      moneyNumber(form.salePrice),
      moneyNumber(form.shippingPrice),
      form.shipStatus,
    )
  ), [form.salePrice, form.costPrice, form.shippingPrice, form.shipStatus]);

  const advisorOptions = useMemo(() => {
    const names = new Set<string>();
    (data?.summary.orders || []).forEach((row) => {
      const name = row.advisor.trim();
      if (name) names.add(name);
    });
    (data?.people || []).forEach((person) => {
      const name = person.advisor.trim();
      if (name) names.add(name);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'es'));
  }, [data]);

  const filteredOrders = useMemo(() => {
    const rows = data?.summary.orders || [];
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (advisorFilter && row.advisor.trim().toLowerCase() !== advisorFilter.trim().toLowerCase()) return false;
      if (transportFilter && row.transport !== transportFilter) return false;
      if (appliedFrom && row.orderDate < appliedFrom) return false;
      if (appliedTo && row.orderDate > appliedTo) return false;
      if (!q) return true;
      return `${row.guideNumber} ${row.firstName} ${row.lastName} ${row.transport} ${row.advisor} ${row.qrCode || ''} ${row.shipStatus}`
        .toLowerCase()
        .includes(q);
    });
  }, [data, query, advisorFilter, transportFilter, appliedFrom, appliedTo]);

  const filteredProfit = useMemo(
    () => filteredOrders.reduce((sum, row) => sum + row.profit, 0),
    [filteredOrders],
  );

  function applyDateFilter() {
    setAppliedFrom(dateFrom);
    setAppliedTo(dateTo);
    setDateRange(dateFrom || dateTo ? 'custom' : 'all');
    setMonthPick('');
  }

  function pickRange(key: DateRangeKey) {
    const range = resolveDateRange(key);
    setDateRange(key);
    setDateFrom(range.from);
    setDateTo(range.to);
    setAppliedFrom(range.from);
    setAppliedTo(range.to);
    setMonthPick('');
  }

  function pickMonth(value: string) {
    setMonthPick(value);
    if (!value) {
      setDateRange('all');
      setDateFrom('');
      setDateTo('');
      setAppliedFrom('');
      setAppliedTo('');
      return;
    }
    const range = resolveMonthRange(value);
    setDateRange('custom');
    setDateFrom(range.from);
    setDateTo(range.to);
    setAppliedFrom(range.from);
    setAppliedTo(range.to);
  }

  function clearSheetFilters() {
    setQuery('');
    setAdvisorFilter('');
    setTransportFilter('');
    setDateFrom('');
    setDateTo('');
    setAppliedFrom('');
    setAppliedTo('');
    setDateRange('all');
    setMonthPick('');
  }

  function applyPerson(personId: string) {
    const person = data?.people.find((item) => item.id === personId);
    if (!person) {
      setForm((current) => ({ ...current, personPick: '' }));
      return;
    }
    setForm((current) => ({
      ...current,
      personPick: personId,
      firstName: person.firstName,
      lastName: person.lastName,
      transport: normalizeTransport(person.transport) || current.transport,
      advisor: person.advisor || current.advisor,
    }));
  }

  function loadOrder(order: ExcelOrder) {
    setEditingId(order.id);
    setForm({
      guideNumber: order.guideNumber,
      firstName: order.firstName,
      lastName: order.lastName,
      transport: normalizeTransport(order.transport),
      advisor: order.advisor,
      shipStatus: order.shipStatus,
      costPrice: String(order.costPrice || ''),
      salePrice: String(order.salePrice || ''),
      shippingPrice: String(order.shippingPrice || ''),
      orderDate: order.orderDate,
      pairId: order.pairId || '',
      linkedCode: order.qrCode || '',
      personPick: order.personId || '',
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
        transport: normalizeTransport(result.suggested.transport) || current.transport,
        advisor: result.suggested.advisor || current.advisor,
        shipStatus: result.suggested.shipStatus,
        costPrice: String(result.suggested.costPrice || current.costPrice || ''),
        salePrice: String(result.suggested.salePrice || ''),
        shippingPrice: String(result.suggested.shippingPrice || current.shippingPrice || ''),
        orderDate: result.suggested.orderDate,
        pairId: result.suggested.pairId,
        linkedCode: result.pair.qrCode,
        personPick: result.person?.id || current.personPick,
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
    if (!form.transport) {
      setError('Elige una transportadora: Interrapidisimo, Coordinadora, Envia o TCC.');
      return;
    }
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

  async function changeStatus(order: ExcelOrder, shipStatus: ExcelShipStatus) {
    if (order.shipStatus === shipStatus) return;
    setStatusBusyId(order.id);
    setError('');
    try {
      const next = await updateExcelOrder(order.id, { shipStatus });
      setData(next);
      if (editingId === order.id) {
        setForm((current) => ({ ...current, shipStatus }));
      }
      bump();
      notify(
        shipStatus === 'Devolución'
          ? `Devolución marcada: se resta el envío (${formatMoney(order.shippingPrice)}) del total.`
          : `Estado actualizado a ${shipStatus}.`,
        'ok',
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo actualizar el estado.');
    } finally {
      setStatusBusyId(null);
    }
  }

  const channel = data?.sheetChannel[sheet];
  const shipStatuses = data?.shipStatuses || ['Enviado', 'Problema', 'Devolución', 'Entregado'];

  return (
    <div className="stack page exel-page">
      <PageHeader
        eyebrow="Cuentas"
        title="Exel"
        text="Llena arriba como una fila nueva y ve la hoja completa abajo. Escanea el par para traer precio y datos de la persona sin mover inventario."
      />

      <div className="exel-toolbar">
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
        {data && (
          <div className="exel-toolbar-meta">
            <span>{filteredOrders.length} de {data.summary.count} filas</span>
            <strong>{formatMoney(filteredProfit)}</strong>
            {channel && <small>Canal {channelLabel[channel]}</small>}
          </div>
        )}
      </div>

      {error && <p className="form-error">{error}</p>}

      <section className="panel exel-entry">
        <header className="panel-head">
          <h2>{editingId ? 'Editar fila' : 'Nueva fila'}</h2>
          <div className="exel-entry-tags">
            {form.linkedCode && <StatusPill status="salida" channel={channel} />}
            {form.linkedCode && <span className="pill inventario">Par {form.linkedCode}</span>}
          </div>
        </header>

        <form
          className="exel-scan-row"
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
          <button className="btn primary" type="submit" disabled={busy}>Traer datos</button>
          {!!data?.people.length && (
            <label className="field">
              <span>Persona guardada</span>
              <select value={form.personPick} onChange={(event) => applyPerson(event.target.value)}>
                <option value="">Elegir para rellenar nombre…</option>
                {data.people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.firstName} {person.lastName}
                  </option>
                ))}
              </select>
            </label>
          )}
        </form>
        {scanNote && <p className="scan-result ok compact-note"><span>{scanNote}</span></p>}

        <form className="exel-entry-grid" onSubmit={submit}>
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
            <select
              value={form.transport}
              onChange={(event) => setForm({ ...form, transport: event.target.value as Transport | '' })}
              required
            >
              <option value="">Seleccionar…</option>
              {TRANSPORTS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Asesora</span>
            <input value={form.advisor} onChange={(event) => setForm({ ...form, advisor: event.target.value })} />
          </label>
          <label className="field">
            <span>Estado de envío</span>
            <select value={form.shipStatus} onChange={(event) => setForm({ ...form, shipStatus: event.target.value as ExcelShipStatus })}>
              {shipStatuses.map((status) => (
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
            <span>Ganancia</span>
            <input value={formatMoney(profitPreview)} readOnly />
          </label>
          <div className="exel-entry-actions">
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Agregar a la hoja'}
            </button>
            {editingId && (
              <button className="btn ghost" type="button" onClick={resetForm} disabled={busy}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="panel exel-filters" aria-label="Filtros de la hoja">
        <header className="panel-head">
          <h2>Filtros de la hoja</h2>
          <span className="muted">{filteredOrders.length} visibles</span>
        </header>
        <div className="exel-filter-rows">
          <div className="exel-filter-row">
            <input
              className="search exel-filter-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar guía, nombre, código…"
              aria-label="Buscar en la hoja"
            />
            <div className="filter-ranges" role="tablist" aria-label="Periodo">
              {DATE_RANGE_OPTIONS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={dateRange === item.key ? 'active' : ''}
                  onClick={() => pickRange(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="exel-filter-row">
            <div className="filter-dates">
              <input
                type="date"
                className="date-input"
                value={dateFrom}
                onChange={(event) => {
                  setDateFrom(event.target.value);
                  setDateRange('custom');
                  setMonthPick('');
                }}
                onKeyDown={(event) => handleDateFilterEnterKey(event, applyDateFilter, dateEnterRef)}
                aria-label="Desde"
                title="Desde — Enter siguiente · doble Enter filtrar"
              />
              <input
                type="date"
                className="date-input"
                value={dateTo}
                onChange={(event) => {
                  setDateTo(event.target.value);
                  setDateRange('custom');
                  setMonthPick('');
                }}
                onKeyDown={(event) => handleDateFilterEnterKey(event, applyDateFilter, dateEnterRef)}
                aria-label="Hasta"
                title="Hasta — Enter siguiente · doble Enter filtrar"
              />
              <button
                type="button"
                className="btn ghost filter-go"
                disabled={!dateFrom && !dateTo}
                onClick={applyDateFilter}
              >
                Filtrar
              </button>
            </div>
            <input
              type="month"
              className="date-input exel-month-input"
              value={monthPick}
              onChange={(event) => pickMonth(event.target.value)}
              aria-label="Elegir mes"
              title="Elegir mes completo"
            />
            <select
              value={advisorFilter}
              aria-label="Asesora"
              onChange={(event) => setAdvisorFilter(event.target.value)}
            >
              <option value="">Todas las asesoras</option>
              {advisorOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <select
              value={transportFilter}
              aria-label="Transportadora"
              onChange={(event) => setTransportFilter(event.target.value)}
            >
              <option value="">Todas las transportadoras</option>
              {TRANSPORTS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <button type="button" className="btn ghost" onClick={clearSheetFilters}>Limpiar</button>
          </div>
        </div>
      </section>

      <section className="panel exel-sheet">
        <header className="panel-head">
          <h2>Hoja {sheet}</h2>
          <span className="muted">{filteredOrders.length} visibles</span>
        </header>

        <div className="exel-sheet-wrap">
          <table className="data exel-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Número de guía</th>
                <th>Nombres</th>
                <th>Apellidos</th>
                <th>Transportadora</th>
                <th>Asesora</th>
                <th>Estado de envío</th>
                <th>Precio fabricación</th>
                <th>Precio venta</th>
                <th>Precio de envío</th>
                <th>Fecha</th>
                <th>Ganancia por pedido</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!filteredOrders.length && (
                <tr>
                  <td colSpan={13}>No hay filas con estos filtros en {sheet}.</td>
                </tr>
              )}
              {filteredOrders.map((order, index) => (
                <tr
                  key={order.id}
                  className={[
                    index % 2 ? 'exel-alt' : '',
                    order.shipStatus === 'Devolución' ? 'exel-return' : '',
                  ].filter(Boolean).join(' ') || undefined}
                >
                  <td>{order.qrCode || order.id.slice(0, 8)}</td>
                  <td>{order.guideNumber || '—'}</td>
                  <td>{order.firstName}</td>
                  <td>{order.lastName}</td>
                  <td>{order.transport || '—'}</td>
                  <td>{order.advisor || '—'}</td>
                  <td>
                    <select
                      className={`exel-status-select ${shipStatusClass(order.shipStatus)}`}
                      value={order.shipStatus}
                      disabled={statusBusyId === order.id || busy}
                      aria-label={`Estado de ${order.firstName} ${order.lastName}`}
                      onChange={(event) => void changeStatus(order, event.target.value as ExcelShipStatus)}
                    >
                      {shipStatuses.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </td>
                  <td className="money">{formatMoney(order.costPrice)}</td>
                  <td className="money">{formatMoney(order.salePrice)}</td>
                  <td className="money">{formatMoney(order.shippingPrice)}</td>
                  <td>{order.orderDate}</td>
                  <td className={`money ${order.profit < 0 ? 'exel-loss' : ''}`}>{formatMoney(order.profit)}</td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="btn ghost" onClick={() => loadOrder(order)}>Editar</button>
                      <button type="button" className="btn danger" onClick={() => void removeOrder(order)} disabled={busy}>Borrar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {!!filteredOrders.length && (
              <tfoot>
                <tr>
                  <td colSpan={11}>Total de ganancias (filtro actual)</td>
                  <td className={`money ${filteredProfit < 0 ? 'exel-loss' : ''}`}>
                    <strong>{formatMoney(filteredProfit)}</strong>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </div>
  );
}
