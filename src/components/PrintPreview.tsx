import { useEffect, useRef, useState } from 'react';
import { checkLabels, confirmLabels } from '../api';
import type { Pair } from '../types';
import { useUi } from '../ui';

type PrintLayout = 'sticker' | 'sheet';

const SHEET_PER_PAGE = 12;

function chunkPairs(items: Pair[], size: number) {
  const pages: Pair[][] = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages.length ? pages : [[]];
}

function Barcode({ value, compact }: { value: string; compact: boolean }) {
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
        height: compact ? 22 : 40,
        width: compact ? 1.05 : 1.4,
      });
    }).catch(() => {});
    return () => { cancel = true; };
  }, [value, compact]);
  return <svg ref={ref} role="img" aria-label={`Código ${value}`} />;
}

export function PrintPreview({ pairIds, onClose }: { pairIds: string[]; onClose: () => void }) {
  const { bump, notify } = useUi();
  const [printable, setPrintable] = useState<Pair[]>([]);
  const [blocked, setBlocked] = useState<Array<{ qrCode: string; reason: string }>>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [layout, setLayout] = useState<PrintLayout>('sticker');

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    document.documentElement.dataset.printLayout = layout;
    return () => {
      delete document.documentElement.dataset.printLayout;
    };
  }, [layout]);

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

  function handlePrint() {
    document.documentElement.dataset.printLayout = layout;
    let style = document.getElementById('evalook-print-page') as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = 'evalook-print-page';
      document.head.appendChild(style);
    }
    style.textContent = layout === 'sticker'
      ? '@page { size: 50mm 30mm; margin: 0; }'
      : '@page { size: A4; margin: 8mm; }';
    window.print();
  }

  return (
    <div className="modal-backdrop">
      <div className="modal wide" role="dialog" aria-modal="true" aria-label="Etiquetas de código de barras">
        <header className="modal-head no-print">
          <div>
            <h2>Etiquetas sticker</h2>
            <p>
              Tamaño para pegar en la plantilla del zapato (50 × 30 mm). Elige sticker individual
              o varios en una hoja A4.
            </p>
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
            <>
              <div className="print-layout-switch" role="tablist" aria-label="Modo de impresión">
                <button
                  type="button"
                  className={layout === 'sticker' ? 'active' : ''}
                  onClick={() => setLayout('sticker')}
                >
                  Sticker 50×30 mm
                </button>
                <button
                  type="button"
                  className={layout === 'sheet' ? 'active' : ''}
                  onClick={() => setLayout('sheet')}
                >
                  A4 · 12 por hoja
                </button>
              </div>
              <p className="muted print-layout-hint">
                {layout === 'sticker'
                  ? 'En el diálogo de impresión elige papel o etiqueta de 50 × 30 mm (o el más cercano) y márgenes en 0.'
                  : 'Imprime en A4 con 12 stickers por hoja (3 × 4). Al llenar la hoja pasa a la siguiente.'}
              </p>
              <div className="form-actions">
                <button type="button" className="btn ghost" onClick={onClose}>Cerrar</button>
                <button type="button" className="btn" onClick={handlePrint}>Imprimir sticker</button>
                <button type="button" className="btn primary" onClick={confirm} disabled={busy}>
                  {busy ? 'Confirmando…' : 'Confirmar etiquetas impresas'}
                </button>
              </div>
            </>
          )}
        </div>
        <div className={`print-root print-layout-${layout}`}>
          {layout === 'sheet' ? (
            chunkPairs(printable, SHEET_PER_PAGE).map((page, pageIndex) => (
              <section className="print-sheet-page" key={`sheet-${pageIndex}`}>
                {page.map((pair) => (
                  <article className="shoe-label" key={pair.id}>
                    <div className="shoe-label-brand">
                      <strong>EVALOOK</strong>
                      <span>T{pair.size}</span>
                    </div>
                    <div className="shoe-label-number">{pair.qrCode}</div>
                    <div className="shoe-label-bar">
                      <Barcode value={pair.qrCode} compact />
                    </div>
                    <div className="shoe-label-copy">
                      <span>{pair.referenceCode} · {pair.color}</span>
                      <span>{pair.name}</span>
                    </div>
                  </article>
                ))}
              </section>
            ))
          ) : (
            printable.map((pair) => (
              <article className="shoe-label" key={pair.id}>
                <div className="shoe-label-brand">
                  <strong>EVALOOK</strong>
                  <span>T{pair.size}</span>
                </div>
                <div className="shoe-label-number">{pair.qrCode}</div>
                <div className="shoe-label-bar">
                  <Barcode value={pair.qrCode} compact />
                </div>
                <div className="shoe-label-copy">
                  <span>{pair.referenceCode} · {pair.color}</span>
                  <span>{pair.name}</span>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
