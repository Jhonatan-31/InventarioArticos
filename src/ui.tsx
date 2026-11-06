import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getSequence } from './api';
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
