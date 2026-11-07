import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getPairs, getReferences } from '../api';
import type { Pair, Reference } from '../types';
import { SHOE_SIZES, formatWhen } from '../format';
import { useUi } from '../ui';
import { PageHeader } from '../components/PageHeader';
import { LabelPill, StatusPill } from '../components/StatusPill';

export function Inventory() {
  const { version, openDamage, openPrint } = useUi();
  const [params] = useSearchParams();
  const [items, setItems] = useState<Pair[]>([]);
  const [refs, setRefs] = useState<Reference[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(params.get('estado') || 'existencia');
  const [referenceId, setReferenceId] = useState(params.get('referencia') || '');
  const [size, setSize] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState('');
  const pageSize = 25;

  useEffect(() => {
    const estado = params.get('estado');
    const referencia = params.get('referencia');
    if (estado) setStatus(estado);
    if (referencia) setReferenceId(referencia);
    if (estado || referencia) setPage(1);
  }, [params]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancel = false;
    getReferences().then((rows) => { if (!cancel) setRefs(rows); }).catch(() => {});
    return () => { cancel = true; };
  }, [version]);

  useEffect(() => {
    let cancel = false;
    const query: Record<string, string> = {
      status,
      page: String(page),
      pageSize: String(pageSize),
    };
    if (referenceId) query.referenceId = referenceId;
    if (size) query.size = size;
    if (fromDate) query.from = fromDate;
    if (toDate) query.to = toDate;
    if (q) query.q = q;
    getPairs(query).then((result) => {
      if (cancel) return;
      setItems(result.items);
      setTotal(result.total);
      setError('');
    }).catch((caught: unknown) => {
      if (!cancel) setError(caught instanceof Error ? caught.message : 'No se pudo cargar el inventario.');
    });
    return () => { cancel = true; };
  }, [version, status, referenceId, size, fromDate, toDate, q, page]);

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const allVisible = items.length > 0 && items.every((item) => selected.includes(item.id));

  function toggle(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function togglePage() {
    setSelected((current) => {
      if (allVisible) return current.filter((id) => !items.some((item) => item.id === id));
      return [...new Set([...current, ...items.map((item) => item.id)])];
    });
  }

  return (
    <div className="stack page">
      <PageHeader
        eyebrow="Pares"
        title="Pares"
        text="Cada fila es un par con su código. Los prioritarios quedan arriba: salieron y volvieron, así que deben ser los primeros en salir."
        actions={
          <>
            <button type="button" className="btn" disabled={selected.length === 0} onClick={() => openPrint(selected)}>
              Imprimir selección
            </button>
            <button type="button" className="btn danger" onClick={() => openDamage('')}>Código dañado</button>
          </>
        }
      />
      <div className="filters filter-bar">
        <label className="filter-field grow">
          <span>Buscar</span>
          <input className="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Código, referencia, color o talla" />
        </label>
        <label className="filter-field">
          <span>Estado</span>
          <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
            <option value="existencia">En existencia</option>
            <option value="prioridad">Prioritarios</option>
            <option value="inventario">Solo normales</option>
            <option value="paginas">Salieron a páginas</option>
            <option value="dropi">Salieron a Dropi</option>
            <option value="salida">Todas las salidas</option>
            <option value="todos">Todos</option>
          </select>
        </label>
        <label className="filter-field">
          <span>Referencia</span>
          <select value={referenceId} onChange={(event) => { setReferenceId(event.target.value); setPage(1); }}>
            <option value="">Todas las referencias</option>
            {refs.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
          </select>
        </label>
        <label className="filter-field">
          <span>Talla</span>
          <select value={size} onChange={(event) => { setSize(event.target.value); setPage(1); }}>
            <option value="">Todas las tallas</option>
            {SHOE_SIZES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="filter-field">
          <span>Ingreso desde</span>
          <input type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setPage(1); }} />
        </label>
        <label className="filter-field">
          <span>Ingreso hasta</span>
          <input type="date" value={toDate} onChange={(event) => { setToDate(event.target.value); setPage(1); }} />
        </label>
        <div className="filter-actions">
          <button
            type="button"
            className="btn small ghost"
            onClick={() => {
              setStatus('existencia');
              setReferenceId('');
              setSize('');
              setFromDate('');
              setToDate('');
              setSearch('');
              setPage(1);
            }}
          >
            Limpiar
          </button>
        </div>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th><input type="checkbox" checked={allVisible} onChange={togglePage} aria-label="Seleccionar página" /></th>
              <th>Código</th>
              <th>Referencia</th>
              <th>Detalle</th>
              <th>Estado</th>
              <th>Etiqueta</th>
              <th>Ingreso</th>
              <th>Salida</th>
              <th>Devolución</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={10}>No hay pares con este filtro.</td></tr>}
            {items.map((item) => (
              <tr key={item.id} className={item.status === 'prioridad' ? 'priority' : ''}>
                <td><input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} aria-label={`Seleccionar ${item.qrCode}`} /></td>
                <td className="mono">{item.qrCode}</td>
                <td>{item.referenceCode}<small>{item.line}</small></td>
                <td>{item.name}<small>{item.color} · Talla {item.size}</small></td>
                <td><StatusPill status={item.status} channel={item.channel} /></td>
                <td><LabelPill state={item.labelState} /></td>
                <td>{formatWhen(item.createdAt)}</td>
                <td>{formatWhen(item.exitedAt)}</td>
                <td>{formatWhen(item.returnedAt)}</td>
                <td><button type="button" className="btn small ghost" onClick={() => openDamage(item.qrCode)}>Novedad</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pager">
        <span>Mostrando {from}–{to} de {total}</span>
        <div>
          <button type="button" className="btn small ghost" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Anterior</button>
          <span>{page} / {pages}</span>
          <button type="button" className="btn small ghost" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>Siguiente</button>
        </div>
      </div>
    </div>
  );
}
