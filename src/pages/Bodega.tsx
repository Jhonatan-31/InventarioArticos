import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getBodega, updateReference } from '../api';
import type { BodegaData, BodegaRow } from '../types';
import { formatDay, formatMoney } from '../format';
import { useUi } from '../ui';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { ImageLightbox } from '../components/ImageLightbox';
import {
  emptyReferenceForm,
  ReferenceFields,
  referenceToForm,
  referenceToInput,
  type ReferenceFormState,
} from '../components/ReferenceForm';

export function Bodega() {
  const { version, bump, notify } = useUi();
  const [data, setData] = useState<BodegaData | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<BodegaRow | null>(null);
  const [editForm, setEditForm] = useState<ReferenceFormState>(emptyReferenceForm);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<BodegaRow | null>(null);

  useEffect(() => {
    let cancel = false;
    getBodega().then((next) => { if (!cancel) setData(next); }).catch((caught: unknown) => {
      if (!cancel) setError(caught instanceof Error ? caught.message : 'No se pudo cargar la bodega.');
    });
    return () => { cancel = true; };
  }, [version]);

  const rows = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!data) return [];
    if (!text) return data.rows;
    return data.rows.filter((row) => [row.code, row.name, row.color, row.silhouette, row.material, row.location, row.line]
      .join(' ')
      .toLowerCase()
      .includes(text));
  }, [data, query]);

  const sizes = data?.sizes || [];

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    try {
      await updateReference(editing.id, referenceToInput(editForm));
      setEditing(null);
      bump();
      notify('Referencia actualizada.', 'ok');
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'No se pudo actualizar.', 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack page">
      <PageHeader
        eyebrow="Existencia"
        title="Bodega"
        text="Lo que hay por referencia, color y talla. El total y el valor salen de los pares que siguen en inventario."
        actions={<Link className="btn primary" to="/entrada">Ingresar pares</Link>}
      />
      {error && <p className="form-error">{error}</p>}
      {data && (
        <section className="kpi-grid money-grid">
          <article className="kpi">
            <span>Pares en bodega</span>
            <strong>{data.totals.pairs}</strong>
            <small>{data.totals.priority} prioritarios</small>
          </article>
          <article className="kpi accent">
            <span>Plata en bodega</span>
            <strong className="money-kpi">{formatMoney(data.totals.value)}</strong>
            <small>Precio por existencia</small>
          </article>
          <article className="kpi">
            <span>Referencias</span>
            <strong>{data.rows.length}</strong>
            <small>Tallas 34 a 45</small>
          </article>
        </section>
      )}
      <section className="panel bodega-panel">
        <header className="panel-head">
          <h2>Inventario por talla</h2>
          <input className="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar referencia, color o ubicación" />
        </header>
        <div className="bodega-wrap">
          <table className="bodega">
            <thead>
              <tr>
                <th className="left">Imagen</th>
                <th className="left">Referencia</th>
                <th className="left">Descripción</th>
                <th className="left">Silueta</th>
                <th className="left">Material</th>
                <th className="left">Ubicación</th>
                <th className="left">Color</th>
                <th>Precio</th>
                <th>F. últ. ent</th>
                <th>F. últ. sal</th>
                <th>Prio</th>
                <th>Total</th>
                <th>Valor</th>
                {sizes.map((size) => <th key={size}>{size}</th>)}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td className="left" colSpan={14 + sizes.length}>No hay referencias para mostrar.</td></tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className={row.priority > 0 ? 'priority' : ''}>
                  <td>
                    {row.image ? (
                      <button
                        type="button"
                        className="thumb"
                        onClick={() => setPreview(row)}
                        title={`Ver imagen de ${row.code}`}
                        aria-label={`Ver imagen de ${row.code}`}
                      >
                        <img src={row.image} alt="" />
                      </button>
                    ) : (
                      <span className="thumb empty-thumb" />
                    )}
                  </td>
                  <td className="left mono">{row.code}</td>
                  <td className="left">{row.name}</td>
                  <td className="left">{row.silhouette || '—'}</td>
                  <td className="left">{row.material || '—'}</td>
                  <td className="left">{row.location || '—'}</td>
                  <td className="left">{row.color}</td>
                  <td className="money">{formatMoney(row.price)}</td>
                  <td>{formatDay(row.lastEntry) || '—'}</td>
                  <td>{formatDay(row.lastExit) || '—'}</td>
                  <td className={row.priority > 0 ? 'prio' : ''}>{row.priority}</td>
                  <td className="sum">{row.inStock}</td>
                  <td className="money">{formatMoney(row.stockValue)}</td>
                  {sizes.map((size) => (
                    <td key={size} className={row.stockBySize[size] ? 'qty' : 'zero'}>
                      {row.stockBySize[size] || 0}
                      {row.priorityBySize[size] > 0 && <small className="prio-dot" title="Prioritario">{row.priorityBySize[size]}</small>}
                    </td>
                  ))}
                  <td>
                    <div className="actions">
                      <button
                        type="button"
                        className="btn small ghost"
                        onClick={() => {
                          setEditing(row);
                          setEditForm(referenceToForm(row));
                        }}
                      >
                        Editar
                      </button>
                      <Link className="btn small" to={`/entrada?referencia=${row.id}`}>Ingresar</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {data && rows.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={10} className="left">Totales de lo visible</td>
                  <td className="prio">{rows.reduce((sum, row) => sum + row.priority, 0)}</td>
                  <td className="sum">{rows.reduce((sum, row) => sum + row.inStock, 0)}</td>
                  <td className="money">{formatMoney(rows.reduce((sum, row) => sum + row.stockValue, 0))}</td>
                  {sizes.map((size) => (
                    <td key={size} className="sum">{rows.reduce((sum, row) => sum + (row.stockBySize[size] || 0), 0)}</td>
                  ))}
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
      {editing && (
        <Modal title={`Editar ${editing.code}`} onClose={() => setEditing(null)}>
          <form className="stack" onSubmit={saveEdit}>
            <ReferenceFields value={editForm} onChange={setEditForm} />
            <div className="form-actions">
              <button type="button" className="btn ghost" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="btn primary" disabled={busy} type="submit">{busy ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </form>
        </Modal>
      )}
      {preview?.image && (
        <ImageLightbox
          src={preview.image}
          title={`${preview.code} · ${preview.color}`}
          subtitle={`${preview.name}${preview.silhouette ? ` · ${preview.silhouette}` : ''}`}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
