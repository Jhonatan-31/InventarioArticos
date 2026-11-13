import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getRevision, getSequence } from './api';
import { DamageModal } from './components/DamageModal';
import { PrintPreview } from './components/PrintPreview';

interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'err' | 'info';
}

interface Ui {
  version: number;
  nextQr: string;
  bump: () => void;
  notify: (text: string, tone?: Toast['tone']) => void;
  openDamage: (qr?: string) => void;
  openPrint: (ids: string[]) => void;
}

const UiContext = createContext<Ui | null>(null);

export function UiProvider({ children }: { children: React.ReactNode }) {
  const [version, setVersion] = useState(0);
  const [nextQr, setNextQr] = useState('00001');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [damageCode, setDamageCode] = useState<string | null>(null);
  const [printIds, setPrintIds] = useState<string[] | null>(null);
  const lastRevision = useRef('');

  const bump = useCallback(() => setVersion((current) => current + 1), []);
  const openDamage = useCallback((qr = '') => setDamageCode(qr), []);
  const openPrint = useCallback((ids: string[]) => setPrintIds(ids), []);
  const notify = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current.slice(-3), { id, text, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 3800);
  }, []);

  useEffect(() => {
    let cancel = false;
    getSequence().then((data) => {
      if (!cancel) setNextQr(data.nextQr);
    }).catch(() => {});
    return () => { cancel = true; };
  }, [version]);

  // Sincroniza otras sesiones abiertas sin recargar ni cambiar de ruta.
  useEffect(() => {
    let alive = true;
    let pollTimer = 0;
    let source: EventSource | null = null;

    const applyRevision = (revision: string) => {
      if (!alive || !revision) return;
      if (!lastRevision.current) {
        lastRevision.current = revision;
        return;
      }
      if (revision === lastRevision.current) return;
      lastRevision.current = revision;
      bump();
    };

    const poll = async () => {
      try {
        const data = await getRevision();
        applyRevision(data.revision);
      } catch {
        /* red temporal: se reintenta */
      }
    };

    void poll();
    pollTimer = window.setInterval(() => { void poll(); }, 2000);

    try {
      source = new EventSource('/api/events');
      source.addEventListener('revision', (event) => {
        try {
          const payload = JSON.parse(String((event as MessageEvent).data || '{}')) as { revision?: string };
          if (payload.revision) applyRevision(payload.revision);
        } catch {
          /* ignore malformed */
        }
      });
    } catch {
      /* el polling cubre si EventSource no está disponible */
    }

    return () => {
      alive = false;
      window.clearInterval(pollTimer);
      source?.close();
    };
  }, [bump]);

  const value = useMemo(() => ({
    version, nextQr, bump, notify, openDamage, openPrint,
  }), [version, nextQr, bump, notify, openDamage, openPrint]);

  return (
    <UiContext.Provider value={value}>
      {children}
      <div className="toasts no-print" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.tone}`}>{toast.text}</div>
        ))}
      </div>
      {damageCode !== null && (
        <DamageModal initialCode={damageCode} onClose={() => setDamageCode(null)} />
      )}
      {printIds && <PrintPreview pairIds={printIds} onClose={() => setPrintIds(null)} />}
    </UiContext.Provider>
  );
}

export function useUi() {
  const value = useContext(UiContext);
  if (!value) throw new Error('El contexto de la interfaz no está disponible.');
  return value;
}
