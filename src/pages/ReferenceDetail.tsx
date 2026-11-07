import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getPairs, getReference, getReferences } from '../api';
import type { Pair, Reference } from '../types';
import { SHOE_SIZES, formatMoney, formatWhen } from '../format';
import {
  DATE_RANGE_OPTIONS,
  type DateRangeKey,
  handleDateFilterEnterKey,
  resolveDateRange,
} from '../dateFilterEnter';
import { useUi } from '../ui';
import { PageHeader } from '../components/PageHeader';
import { LabelPill, StatusPill } from '../components/StatusPill';

export function ReferenceDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { version, openDamage, openPrint } = useUi();
  const [reference, setReference] = useState<Reference | null>(null);
  const [refs, setRefs] = useState<Reference[]>([]);
  const [items, setItems] = useState<Pair[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [view, setView] = useState<'existencia' | 'salida' | 'todos'>('existencia');
  const [size, setSize] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo, setAppliedTo] = useState('');
  const [dateRange, setDateRange] = useState<DateRangeKey>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState('');
  const dateEnterRef = useRef(0);
  const pageSize = 50;

  useEffect(() => {
    let cancel = false;
    getReferences()
      .then((rows) => { if (!cancel) setRefs(rows); })
      .catch(() => {});
    return () => { cancel = true; };
  }, [version]);

  useEffect(() => {
    let cancel = false;
    if (!id) return undefined;
    getReference(id)
      .then((row) => { if (!cancel) setReference(row); })
      .catch((caught: unknown) => {
        if (!cancel) setError(caught instanceof Error ? caught.message : 'No se pudo cargar la referencia.');
      });
    return () => { cancel = true; };
  }, [id, version]);

  useEffect(() => {
    let cancel = false;
    if (!id) return undefined;
    setSelected([]);
    const query: Record<string, string> = {
      referenceId: id,
      status: view,
      page: String(page),
      pageSize: String(pageSize),
    };
    if (size) query.size = size;
    if (appliedFrom) query.from = appliedFrom;
    if (appliedTo) query.to = appliedTo;
    getPairs(query).then((result) => {
      if (cancel) return;
      setItems(result.items);
      setTotal(result.total);
      setError('');
    }).catch((caught: unknown) => {
      if (!cancel) setError(caught instanceof Error ? caught.message : 'No se pudieron cargar los códigos.');
    });
    return () => { cancel = true; };
  }, [id, version, view, size, appliedFrom, appliedTo, page]);

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const allVisible = items.length > 0 && items.every((item) => selected.includes(item.id));
  const printable = items.filter((item) => item.status !== 'salida' && selected.includes(item.id));

  function toggle(pairId: string) {
    setSelected((current) => (
      current.includes(pairId) ? current.filter((item) => item !== pairId) : [...current, pairId]
    ));
  }

  function togglePage() {
    setSelected((current) => {
      if (allVisible) return current.filter((pairId) => !items.some((item) => item.id === pairId));
      return [...new Set([...current, ...items.map((item) => item.id)])];
    });
  }

  function applyDateFilter() {
    setAppliedFrom(dateFrom);
    setAppliedTo(dateTo);
    setDateRange(dateFrom || dateTo ? 'custom' : 'all');
    setPage(1);
  }

  function pickRange(key: DateRangeKey) {
    const range = resolveDateRange(key);
    setDateRange(key);
    setDateFrom(range.from);
    setDateTo(range.to);
    setAppliedFrom(range.from);
    setAppliedTo(range.to);
    setPage(1);
  }

  function clearFilters() {
    setView('existencia');
    setSize('');
    setDateFrom('');
    setDateTo('');
    setAppliedFrom('');
    setAppliedTo('');
    setDateRange('all');
    setPage(1);
  }

  if (error && !reference) {
    return (
      <div className="stack page">
        <PageHeader eyebrow="Referencia" title="No encontrada" />
        <p className="form-error">{error}</p>
        <Link className="btn" to="/referencias">Volver al catálogo</Link>
      </div>
    );
  }

  return (
    <div className="stack page">
      <PageHeader
        eyebrow="Referencia"
        title={reference ? reference.code : 'Cargando…'}
        text={reference ? `${reference.name} · ${reference.color}` : 'Cargando la referencia y sus códigos.'}
        actions={
          reference && (
            <>
              <Link className="btn" to={`/entrada?referencia=${reference.id}`}>Ingresar pares</Link>
              <button
                type="button"
                className="btn primary"
                disabled={printable.length === 0}
                onClick={() => openPrint(printable.map((item) => item.id))}
              >
                Imprimir selección
              </button>
            </>
          )
        }
      />

      {reference && (
        <section className="kpi-grid">
          <article className="kpi">
            <span>En bodega</span>
            <strong>{reference.inStock}</strong>
            <small>Incluye prioritarios</small>
          </article>
          <article className="kpi accent">
            <span>Prioritarios</span>
            <strong>{reference.priority}</strong>
            <small>Salen primero</small>
          </article>
          <article className="kpi">
            <span>Fuera</span>
            <strong>{reference.out}</strong>
            <small>Ya salieron</small>
          </article>
          <article className="kpi">
            <span>Códigos creados</span>
            <strong>{reference.total}</strong>
            <small>Valor {formatMoney(reference.inStock * reference.price)}</small>
          </article>
        </section>
      )}

      <div className="panel filter-panel">
        <div className="inventory-toolbar">
          <div className="filter-ranges" role="tablist" aria-label="Periodo de ingreso">
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
          <div className="filter-dates">
            <input
              type="date"
              className="date-input"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value);
                setDateRange('custom');
              }}
              onKeyDown={(event) => handleDateFilterEnterKey(event, applyDateFilter, dateEnterRef)}
              aria-label="Ingreso desde"
              title="Desde — Enter siguiente · doble Enter filtrar"
            />
            <input
              type="date"
              className="date-input"
              value={dateTo}
              onChange={(event) => {
                setDateTo(event.target.value);
                setDateRange('custom');
              }}
              onKeyDown={(event) => handleDateFilterEnterKey(event, applyDateFilter, dateEnterRef)}
              aria-label="Ingreso hasta"
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
          <span className="filter-caption">Filtros</span>
          <select
            value={id}
            aria-label="Referencia"
            onChange={(event) => {
              navigate(`/referencias/${event.target.value}`);
              setPage(1);
            }}
          >
            {refs.map((item) => (
              <option key={item.id} value={item.id}>{item.code} · {item.name}</option>
            ))}
          </select>
          <select
            value={view}
            aria-label="Estado"
            onChange={(event) => {
              setView(event.target.value as 'existencia' | 'salida' | 'todos');
              setPage(1);
            }}
          >
            <option value="existencia">En bodega</option>
            <option value="salida">Ya salieron</option>
            <option value="todos">Todos los códigos</option>
          </select>
          <select
            value={size}
            aria-label="Talla"
            onChange={(event) => {
              setSize(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Todas las tallas</option>
            {SHOE_SIZES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <button type="button" className="btn ghost" onClick={clearFilters}>Limpiar</button>
          <Link className="btn ghost" to="/referencias">Volver</Link>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={allVisible}
                  onChange={togglePage}
                  aria-label="Seleccionar página"
                  disabled={view === 'salida'}
                />
              </th>
              <th>Código</th>
              <th>Talla</th>
              <th>Estado</th>
              <th>Etiqueta</th>
              <th>Ingreso</th>
              <th>Salida</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={8}>
                  {view === 'existencia'
                    ? 'No hay pares en bodega con estos filtros.'
                    : 'No hay códigos con este filtro.'}
                </td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id} className={item.status === 'prioridad' ? 'priority' : ''}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.includes(item.id)}
                    onChange={() => toggle(item.id)}
                    aria-label={`Seleccionar ${item.qrCode}`}
                    disabled={item.status === 'salida'}
                  />
                </td>
                <td className="mono">{item.qrCode}</td>
                <td>{item.size}</td>
                <td><StatusPill status={item.status} channel={item.channel} /></td>
                <td><LabelPill state={item.labelState} /></td>
                <td>{formatWhen(item.createdAt)}</td>
                <td>{formatWhen(item.exitedAt)}</td>
                <td>
                  <button type="button" className="btn small ghost" onClick={() => openDamage(item.qrCode)}>
                    Novedad
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pager">
        <span>Mostrando {from}–{to} de {total}</span>
        <div>
          <button type="button" className="btn small ghost" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
            Anterior
          </button>
          <span>{page} / {pages}</span>
          <button type="button" className="btn small ghost" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
