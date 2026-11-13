import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createReference, deleteReference, getReferences, updateReference } from '../api';
import type { Reference } from '../types';
import { formatMoney } from '../format';
import { useUi } from '../ui';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import {
  emptyReferenceForm,
  ReferenceFields,
  referenceToForm,
  referenceToInput,
  type ReferenceFormState,
} from '../components/ReferenceForm';

export function References() {
  const { version, bump, notify } = useUi();
  const [items, setItems] = useState<Reference[]>([]);
  const [form, setForm] = useState<ReferenceFormState>(emptyReferenceForm);
  const [editing, setEditing] = useState<Reference | null>(null);
  const [editForm, setEditForm] = useState<ReferenceFormState>(emptyReferenceForm);
  const [created, setCreated] = useState<Reference | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancel = false;
    getReferences().then((rows) => { if (!cancel) setItems(rows); }).catch((caught: unknown) => {
      if (!cancel) setError(caught instanceof Error ? caught.message : 'No se pudieron cargar las referencias.');
    });
    return () => { cancel = true; };
  }, [version]);

  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return items;
    return items.filter((item) => [item.code, item.name, item.color, item.line, item.location, item.silhouette].join(' ').toLowerCase().includes(text));
  }, [items, query]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const reference = await createReference(referenceToInput(form));
      setCreated(reference);
      setForm(emptyReferenceForm);
      bump();
      notify('Referencia creada.', 'ok');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo crear la referencia.');
    } finally {
      setBusy(false);
    }
  }

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

  async function remove(item: Reference) {
    if (!window.confirm(`¿Eliminar la referencia ${item.code}?`)) return;
    try {
      await deleteReference(item.id);
      bump();
      notify('Referencia eliminada.', 'ok');
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'No se pudo eliminar.', 'err');
    }
  }

  return (
    <div className="stack page">
      <PageHeader
        eyebrow="Catálogo"
        title="Referencias"
        text="Puedes repetir la misma referencia con otro color (por ejemplo LINNER negro y LINNER miel). Lo que no se puede repetir es la misma referencia con el mismo color. Cada par sigue teniendo su código único."
      />
      <section className="panel">
        <header className="panel-head"><h2>Nueva referencia</h2></header>
        <form className="stack" onSubmit={create}>
          <ReferenceFields value={form} onChange={setForm} />
          {error && <p className="form-error">{error}</p>}
          <div className="form-actions">
            <button className="btn primary" disabled={busy} type="submit">{busy ? 'Guardando…' : 'Crear referencia'}</button>
          </div>
        </form>
      </section>
      {created && (
        <section className="callout">
          <div>
            <strong>{created.code} quedó creada</strong>
            <p>Ahora ingresa los pares por talla. Cada par recibe un código nuevo y único.</p>
          </div>
          <Link className="btn primary" to={`/entrada?referencia=${created.id}`}>Ingresar por talla</Link>
        </section>
      )}
      <section className="panel">
        <header className="panel-head">
          <h2>Catálogo</h2>
          <input className="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar referencia" />
        </header>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Referencia</th>
                <th>Descripción</th>
                <th>Color</th>
                <th>Ubicación</th>
                <th>Precio</th>
                <th>Existencia</th>
                <th>Valor</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && <tr><td colSpan={8}>No hay referencias para mostrar.</td></tr>}
              {visible.map((item) => (
                <tr key={item.id} className={item.priority > 0 ? 'priority' : ''}>
                  <td className="mono"><Link to={`/referencias/${item.id}`}>{item.code}</Link></td>
                  <td>{item.name}<small>{item.line}{item.silhouette ? ` · ${item.silhouette}` : ''}</small></td>
                  <td>{item.color}</td>
                  <td>{item.location || '—'}</td>
                  <td className="money">{formatMoney(item.price)}</td>
                  <td>{item.inStock}</td>
                  <td className="money">{formatMoney(item.inStock * item.price)}</td>
                  <td className="actions">
                    <Link className="btn small" to={`/referencias/${item.id}`}>Ver códigos</Link>
                    <Link className="btn small" to={`/entrada?referencia=${item.id}`}>Ingresar</Link>
                    <button type="button" className="btn small ghost" onClick={() => { setEditing(item); setEditForm(referenceToForm(item)); }}>Editar</button>
                    {item.total === 0 && <button type="button" className="btn small ghost" onClick={() => remove(item)}>Eliminar</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {editing && (
        <Modal title={`Editar ${editing.code}`} onClose={() => setEditing(null)}>
          <form className="stack" onSubmit={saveEdit}>
            <ReferenceFields value={editForm} onChange={setEditForm} />
            <div className="form-actions">
              <button type="button" className="btn ghost" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="btn primary" disabled={busy} type="submit">Guardar</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
