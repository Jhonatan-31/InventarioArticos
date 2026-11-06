import { useEffect, useRef, useState } from 'react';
import { checkLabels, confirmLabels } from '../api';
import type { Pair } from '../types';
import { useUi } from '../ui';

function Barcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    let cancel = false;
    import('jsbarcode/dist/JsBarcode.all.min.js').then(() => {
      const draw = (window as Window & {
        JsBarcode?: (element: SVGSVGElement, text: string, options: Record<string, unknown>) => void;
      }).JsBarcode;
      if (cancel || !ref.current || !draw) return;
      draw(ref.current, value, {
        format: 'CODE128',
        displayValue: false,
        margin: 0,
        height: 52,
        width: 1.7,
      });
    }).catch(() => {});
    return () => { cancel = true; };
  }, [value]);
  return <svg ref={ref} role="img" aria-label={`Código ${value}`} />;
}

export function PrintPreview({ pairIds, onClose }: { pairIds: string[]; onClose: () => void }) {
  const { bump, notify } = useUi();
  const [printable, setPrintable] = useState<Pair[]>([]);
  const [blocked, setBlocked] = useState<Array<{ qrCode: string; reason: string }>>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let cancel = false;
    setError('');
    setReady(false);
    checkLabels(pairIds).then((check) => {
      if (cancel) return;
      setPrintable(check.printable);
      setBlocked(check.blocked);
      setReady(true);
    }).catch((caught: unknown) => {
      if (!cancel) setError(caught instanceof Error ? caught.message : 'No se pudieron preparar las etiquetas.');
    });
    return () => { cancel = true; };
  }, [pairIds]);

  async function confirm() {
    if (!printable.length) return;
    setBusy(true);
    try {
      await confirmLabels(printable.map((pair) => pair.id));
      bump();
      notify('Impresión confirmada. Esos códigos quedan activos.', 'ok');
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo confirmar la impresión.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal wide" role="dialog" aria-modal="true" aria-label="Etiquetas de código de barras">
        <header className="modal-head no-print">
          <div>
            <h2>Etiquetas para pegar</h2>
            <p>Cada código conserva su número. Después de pegarlas, confirma la impresión. Si una se daña, registra la novedad y vuelve a salir el mismo código.</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">×</button>
        </header>
        <div className="no-print stack">
          {error && <p className="form-error">{error}</p>}
          {!ready && !error && <p className="muted">Preparando etiquetas…</p>}
          {blocked.length > 0 && (
            <div className="callout warn">
              <strong>Hay códigos que todavía no se pueden reimprimir</strong>
              <ul>
                {blocked.map((item) => <li key={item.qrCode}>{item.reason}</li>)}
              </ul>
            </div>
          )}
          {printable.length > 0 && (
            <div className="form-actions">
              <button type="button" className="btn ghost" onClick={onClose}>Cerrar</button>
              <button type="button" className="btn" onClick={() => window.print()}>Imprimir</button>
              <button type="button" className="btn primary" onClick={confirm} disabled={busy}>
                {busy ? 'Confirmando…' : 'Confirmar etiquetas impresas'}
              </button>
            </div>
          )}
        </div>
        <div className="print-root">
          {printable.map((pair) => (
            <article className="shoe-label" key={pair.id}>
              <div className="shoe-label-brand">
                <strong>CALZADO EVALOOK</strong>
                <span>Par de inventario</span>
              </div>
              <Barcode value={pair.qrCode} />
              <div className="shoe-label-copy">
                <b>{pair.qrCode}</b>
                <span>{pair.referenceCode} · Talla {pair.size}</span>
                <span>{pair.name}</span>
                <span>{pair.color} · {pair.line}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
