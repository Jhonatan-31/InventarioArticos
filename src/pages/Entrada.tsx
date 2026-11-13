import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { addStock, getReferences } from '../api';
import type { PairBatch, Reference } from '../types';
import { SHOE_SIZES, formatMoney } from '../format';
import { useUi } from '../ui';
import { PageHeader } from '../components/PageHeader';
import { ImageLightbox } from '../components/ImageLightbox';

export function Entrada() {
  const { version, nextQr, bump, notify, openPrint } = useUi();
  const [params] = useSearchParams();
  const [refs, setRefs] = useState<Reference[]>([]);
  const [referenceId, setReferenceId] = useState(params.get('referencia') || '');
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [batch, setBatch] = useState<PairBatch | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    const selected = params.get('referencia');
    if (selected) setReferenceId(selected);
  }, [params]);

  useEffect(() => {
    let cancel = false;
    getReferences().then((rows) => { if (!cancel) setRefs(rows); }).catch((caught: unknown) => {
      if (!cancel) setError(caught instanceof Error ? caught.message : 'No se pudieron cargar las referencias.');
    });
    return () => { cancel = true; };
  }, [version]);

  const reference = refs.find((item) => item.id === referenceId) || null;
  const parsed = useMemo(() => {
    const clean: Record<string, number> = {};
    let total = 0;
    SHOE_SIZES.forEach((size) => {
      const qty = Number(quantities[size] || 0);
      if (!qty) return;
      clean[size] = qty;
      total += qty;
    });
    return { clean, total };
  }, [quantities]);
  const previewEnd = parsed.total > 0
    ? String(Number(nextQr) + parsed.total - 1).padStart(5, '0')
    : nextQr;
  const money = reference ? parsed.total * reference.price : 0;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!reference) return;
    setBusy(true);
    setError('');
    try {
      const result = await addStock(reference.id, parsed.clean, note);
      setBatch(result);
      setQuantities({});
      setNote('');
      bump();
      notify(`Entraron ${result.quantity} pares, del código ${result.from} al ${result.to}.`, 'ok');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo ingresar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack page">
      <PageHeader
        eyebrow="Ingreso"
        title="Entrada de inventario"
        text="Elige la referencia (por ejemplo 575) y escribe cuántos pares entran por talla. Si entran 70 pares, se crean 70 códigos nuevos. Nunca se reutilizan códigos que ya existan."
      />
      <form className="panel stack" onSubmit={submit}>
        <label className="field">
          <span>Referencia</span>
          <select value={referenceId} onChange={(event) => { setReferenceId(event.target.value); setBatch(null); }} required>
            <option value="">Selecciona una referencia</option>
            {refs.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} · {item.name} · {item.color} · {formatMoney(item.price)}
              </option>
            ))}
          </select>
        </label>
        {refs.length === 0 && (
          <p className="muted">Primero crea la referencia. <Link to="/referencias">Ir a referencias</Link></p>
        )}
        {reference && (
          <div className="pair-mini">
            {reference.image && (
              <button
                type="button"
                className="thumb"
                onClick={() => setPreviewOpen(true)}
                title={`Ver imagen de ${reference.code}`}
                aria-label={`Ver imagen de ${reference.code}`}
              >
                <img src={reference.image} alt="" />
              </button>
            )}
            <strong>{reference.code}</strong>
            <span>{reference.name} · {reference.color} · {reference.line}</span>
            <span>
              {reference.silhouette || 'Sin silueta'} · {reference.material || 'Sin material'} · {reference.location || 'Sin ubicación'}
            </span>
            <span>Precio del par {formatMoney(reference.price)} · En bodega {reference.inStock}</span>
          </div>
        )}
        <div className="size-inputs">
          {SHOE_SIZES.map((size) => (
            <label key={size}>
              <span>{size}</span>
              <input
                inputMode="numeric"
                value={quantities[size] || ''}
                onChange={(event) => setQuantities((current) => ({ ...current, [size]: event.target.value.replace(/\D/g, '').slice(0, 3) }))}
                placeholder="0"
                aria-label={`Pares talla ${size}`}
              />
            </label>
          ))}
        </div>
        <div className="entry-sum">
          <div>
            <span>Pares</span>
            <strong>{parsed.total}</strong>
          </div>
          <div>
            <span>Valor de esta entrada</span>
            <strong>{formatMoney(money)}</strong>
          </div>
          <div>
            <span>Códigos</span>
            <strong className="mono">{parsed.total ? `${nextQr}${previewEnd !== nextQr ? `–${previewEnd}` : ''}` : '—'}</strong>
          </div>
        </div>
        <label className="field">
          <span>Nota de ingreso</span>
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Factura, proveedor o lote" />
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button className="btn primary" type="submit" disabled={busy || !reference || parsed.total < 1}>
            {busy ? 'Ingresando…' : 'Ingresar a bodega'}
          </button>
        </div>
      </form>
      {batch && (
        <section className="callout">
          <div>
            <strong>Entraron {batch.quantity} pares</strong>
            <p>
              Códigos nuevos {batch.from}{batch.from !== batch.to ? ` al ${batch.to}` : ''}.
              {' '}
              {Object.entries(batch.bySize).map(([size, qty]) => `${size}: ${qty}`).join(' · ')}
              {' '}
              Estos números no se vuelven a asignar.
            </p>
          </div>
          <div className="page-actions">
            {reference && (
              <Link className="btn" to={`/referencias/${reference.id}`}>Ver códigos de la referencia</Link>
            )}
            <button type="button" className="btn primary" onClick={() => openPrint(batch.pairs.map((pair) => pair.id))}>
              Imprimir códigos
            </button>
          </div>
        </section>
      )}
      {previewOpen && reference?.image && (
        <ImageLightbox
          src={reference.image}
          title={`${reference.code} · ${reference.color}`}
          subtitle={reference.name}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}
