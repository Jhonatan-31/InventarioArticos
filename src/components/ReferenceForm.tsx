import { useState } from 'react';
import type { Reference, ReferenceInput } from '../types';
import { ImageLightbox } from './ImageLightbox';

const lines = ['Dama', 'Caballero', 'Infantil', 'Unisex'];

export interface ReferenceFormState {
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

export const emptyReferenceForm: ReferenceFormState = {
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

export function referenceToInput(form: ReferenceFormState): ReferenceInput {
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

export function referenceToForm(item: Reference): ReferenceFormState {
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

export function ReferenceFields({
  value,
  onChange,
}: {
  value: ReferenceFormState;
  onChange: (next: ReferenceFormState) => void;
}) {
  const set = (key: keyof ReferenceFormState, next: string) => onChange({ ...value, [key]: next });
  const [imageError, setImageError] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  return (
    <div className="form-grid">
      <label className="field">
        <span>Referencia</span>
        <input value={value.code} onChange={(event) => set('code', event.target.value)} placeholder="575" required />
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
      {value.image && (
        <button
          type="button"
          className="ref-preview"
          onClick={() => setPreviewOpen(true)}
          title="Ver imagen"
          aria-label="Ver imagen de la referencia"
        >
          <img src={value.image} alt="" />
        </button>
      )}
      {imageError && <p className="form-error">{imageError}</p>}
      {previewOpen && value.image && (
        <ImageLightbox
          src={value.image}
          title={value.code || 'Referencia'}
          subtitle={[value.name, value.color].filter(Boolean).join(' · ')}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}
