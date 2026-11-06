import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createReference, deleteReference, getReferences, updateReference } from '../api';
import type { Reference, ReferenceInput } from '../types';
import { formatMoney } from '../format';
import { useUi } from '../ui';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';

const lines = ['Dama', 'Caballero', 'Infantil', 'Unisex'];

interface FormState {
  code: string;
  name: string;
  color: string;
  line: string;
  notes: string;
  silhouette: string;
  material: string;
  location: string;
  price: string;
  image: string;
}

const empty: FormState = {
  code: '',
  name: '',
  color: '',
  line: 'Dama',
  notes: '',
  silhouette: '',
  material: '',
  location: '',
  price: '',
  image: '',
};

function toInput(form: FormState): ReferenceInput {
  return {
    code: form.code,
    name: form.name,
    color: form.color,
    line: form.line,
    notes: form.notes,
    silhouette: form.silhouette,
    material: form.material,
    location: form.location,
    price: Number(form.price || 0),
    image: form.image || undefined,
  };
}

function fromReference(item: Reference): FormState {
  return {
    code: item.code,
    name: item.name,
    color: item.color,
    line: item.line,
    notes: item.notes,
    silhouette: item.silhouette,
    material: item.material,
    location: item.location,
    price: String(item.price || ''),
    image: item.image,
  };
}

function Fields({ value, onChange }: { value: FormState; onChange: (next: FormState) => void }) {
  const set = (key: keyof FormState, next: string) => onChange({ ...value, [key]: next });
  const [imageError, setImageError] = useState('');
  return (
    <div className="form-grid">
      <label className="field">
        <span>Referencia</span>
        <input value={value.code} onChange={(event) => set('code', event.target.value)} placeholder="OX-40" required />
      </label>
      <label className="field">
        <span>Descripción</span>
        <input value={value.name} onChange={(event) => set('name', event.target.value)} placeholder="Oxford clásico" required />
      </label>
      <label className="field">
        <span>Silueta</span>
        <input value={value.silhouette} onChange={(event) => set('silhouette', event.target.value)} placeholder="Oxford" />
      </label>
      <label className="field">
        <span>Material</span>
        <input value={value.material} onChange={(event) => set('material', event.target.value)} placeholder="Cuero" />
      </label>
      <label className="field">
        <span>Ubicación</span>
        <input value={value.location} onChange={(event) => set('location', event.target.value)} placeholder="A-06" />
      </label>
      <label className="field">
        <span>Color</span>
        <input value={value.color} onChange={(event) => set('color', event.target.value)} placeholder="Miel" required />
      </label>
      <label className="field">
        <span>Línea</span>
        <select value={value.line} onChange={(event) => set('line', event.target.value)}>
          {lines.map((line) => <option key={line}>{line}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Precio del par</span>
        <input inputMode="numeric" value={value.price} onChange={(event) => set('price', event.target.value.replace(/\D/g, ''))} placeholder="80000" required />
      </label>
      <label className="field">
        <span>Notas</span>
        <input value={value.notes} onChange={(event) => set('notes', event.target.value)} placeholder="Opcional" />
      </label>
      <label className="field">
        <span>Imagen</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            if (file.size > 1200000) {
              setImageError('La imagen debe pesar menos de 1.2 MB.');
              return;
            }
            setImageError('');
            const reader = new FileReader();
            reader.onload = () => set('image', String(reader.result || ''));
            reader.readAsDataURL(file);
          }}
        />
      </label>
      {value.image && <img className="ref-preview" src={value.image} alt="" />}
      {imageError && <p className="form-error">{imageError}</p>}
    </div>
  );
}

export function References() {
  const { version, bump, notify } = useUi();
  const [items, setItems] = useState<Reference[]>([]);
  const [form, setForm] = useState<FormState>(empty);
  const [editing, setEditing] = useState<Reference | null>(null);
  const [editForm, setEditForm] = useState<FormState>(empty);
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
      const reference = await createReference(toInput(form));
      setCreated(reference);
      setForm(empty);
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
      await updateReference(editing.id, toInput(editForm));
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
        text="La referencia guarda el modelo, el color y el precio. Las tallas se cargan después, en la entrada, par por par."
      />
      <section className="panel">
        <header className="panel-head"><h2>Nueva referencia</h2></header>
        <form className="stack" onSubmit={create}>
          <Fields value={form} onChange={setForm} />
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
            <p>Ahora escribe cuántos pares hay de cada número. El sistema suma la existencia y el valor.</p>
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
                  <td className="mono">{item.code}</td>
                  <td>{item.name}<small>{item.line}{item.silhouette ? ` · ${item.silhouette}` : ''}</small></td>
                  <td>{item.color}</td>
                  <td>{item.location || '—'}</td>
                  <td className="money">{formatMoney(item.price)}</td>
                  <td>{item.inStock}</td>
                  <td className="money">{formatMoney(item.inStock * item.price)}</td>
                  <td className="actions">
                    <Link className="btn small" to={`/entrada?referencia=${item.id}`}>Ingresar</Link>
                    <button type="button" className="btn small ghost" onClick={() => { setEditing(item); setEditForm(fromReference(item)); }}>Editar</button>
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
            <Fields value={editForm} onChange={setEditForm} />
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
