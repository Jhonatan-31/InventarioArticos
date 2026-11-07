import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getPairs, getReference } from '../api';
import type { Pair, Reference } from '../types';
import { formatMoney, formatWhen } from '../format';
import { useUi } from '../ui';
import { PageHeader } from '../components/PageHeader';
import { LabelPill, StatusPill } from '../components/StatusPill';

export function ReferenceDetail() {
  const { id = '' } = useParams();
  const { version, openDamage, openPrint } = useUi();
  const [reference, setReference] = useState<Reference | null>(null);
  const [items, setItems] = useState<Pair[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [view, setView] = useState<'existencia' | 'salida' | 'todos'>('existencia');
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState('');
  const pageSize = 50;

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
    getPairs({
      referenceId: id,
      status: view,
      page: String(page),
      pageSize: String(pageSize),
    }).then((result) => {
      if (cancel) return;
      setItems(result.items);
      setTotal(result.total);
    }).catch((caught: unknown) => {
      if (!cancel) setError(caught instanceof Error ? caught.message : 'No se pudieron cargar los códigos.');
    });
    return () => { cancel = true; };
  }, [id, version, view, page]);

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
        text={reference
          ? `${reference.name} · ${reference.color}. Cada par tiene un código único. Los que salen de bodega dejan de aparecer en “En bodega”. Los nuevos ingresos nunca reutilizan códigos.`
          : 'Cargando la referencia y sus códigos.'}
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

      <div className="filters">
        <select
          value={view}
          onChange={(event) => {
            setView(event.target.value as 'existencia' | 'salida' | 'todos');
            setPage(1);
          }}
        >
          <option value="existencia">En bodega</option>
          <option value="salida">Ya salieron</option>
          <option value="todos">Todos los códigos</option>
        </select>
        <Link className="btn small ghost" to="/referencias">Volver</Link>
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
                    ? 'No hay pares en bodega para esta referencia. Ingresa un lote o revisa “Ya salieron”.'
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
