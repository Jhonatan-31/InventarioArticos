import { useEffect, useState } from 'react';
import { createIncident, lookupPair } from '../api';
import type { Pair } from '../types';
import { useUi } from '../ui';
import { Modal } from './Modal';
import { StatusPill } from './StatusPill';

export function DamageModal({ initialCode, onClose }: { initialCode: string; onClose: () => void }) {
  const { bump, notify, openPrint } = useUi();
  const [code, setCode] = useState(initialCode);
  const [description, setDescription] = useState('');
  const [preview, setPreview] = useState<Pair | null>(null);
  const [done, setDone] = useState<Pair | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const text = code.trim();
    if (text.length < 1) {
      setPreview(null);
      return;
    }
    const timer = window.setTimeout(() => {
      lookupPair(text).then(setPreview).catch(() => setPreview(null));
    }, 280);
    return () => window.clearTimeout(timer);
  }, [code]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await createIncident(code, description);
      setDone(result.pair);
      bump();
      notify(`Novedad registrada para el código ${result.pair.qrCode}.`, 'ok');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar la novedad.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Código dañado"
      text="La novedad queda en el sistema. Después sí se puede imprimir otra vez el mismo código, sin crear uno nuevo."
      onClose={onClose}
    >
      {done ? (
        <div className="stack">
          <div className="callout">
            <strong>Listo el código {done.qrCode}</strong>
            <p>{done.referenceCode} · {done.name} · Talla {done.size}. Ya puedes reimprimir esta misma etiqueta.</p>
          </div>
          <div className="form-actions">
            <button type="button" className="btn ghost" onClick={onClose}>Cerrar</button>
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                onClose();
                openPrint([done.id]);
              }}
            >
              Imprimir el mismo código
            </button>
          </div>
        </div>
      ) : (
        <form className="stack" onSubmit={submit}>
          <label className="field">
            <span>Código de barras</span>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="00001"
              autoFocus
              required
            />
          </label>
          {preview && (
            <div className="pair-mini">
              <strong>{preview.qrCode}</strong>
              <span>{preview.referenceCode} · {preview.name}</span>
              <span>{preview.color} · Talla {preview.size}</span>
              <StatusPill status={preview.status} channel={preview.channel} />
            </div>
          )}
          <label className="field">
            <span>Qué pasó</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Ejemplo: la etiqueta se despegó y se rompió al manipular el par."
              rows={4}
              required
              minLength={8}
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <div className="form-actions">
            <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn primary" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar novedad'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
