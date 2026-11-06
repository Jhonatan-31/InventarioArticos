import { useEffect, useRef, useState } from 'react';
import { getDashboard, scanPair } from '../api';
import type { Channel, Pair } from '../types';
import { useUi } from '../ui';
import { PageHeader } from '../components/PageHeader';
import { StatusPill } from '../components/StatusPill';

interface Result {
  ok: boolean;
  title: string;
  detail: string;
  pair?: Pair;
}

function beep(ok: boolean) {
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = ok ? 880 : 196;
    gain.gain.value = 0.04;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + (ok ? 0.08 : 0.18));
    oscillator.onended = () => context.close();
  } catch {
    /* El escaneo sigue aunque el equipo no reproduzca sonido. */
  }
}

export function Scanner({ mode, channel }: { mode: 'salida' | 'devolucion'; channel?: Channel }) {
  const { version, bump } = useUi();
  const [code, setCode] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [priority, setPriority] = useState<Pair[]>([]);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const queue = useRef<string[]>([]);
  const working = useRef(false);
  const last = useRef({ code: '', at: 0 });
  const title = mode === 'devolucion'
    ? 'Devolución'
    : channel === 'dropi' ? 'Salida para Dropi' : 'Salida para páginas';
  const note = mode === 'devolucion'
    ? 'Al escanear, el par vuelve al inventario como prioritario y se descuenta de la cuenta del canal por el que salió.'
    : channel === 'dropi'
      ? 'Este apartado solo registra salidas de Dropi. Lo que salga aquí no se mezcla con las páginas.'
      : 'Este apartado solo registra salidas de las páginas. Lo que salga aquí no se mezcla con Dropi.';

  useEffect(() => {
    setResult(null);
    setCode('');
  }, [mode, channel]);

  useEffect(() => { inputRef.current?.focus(); }, [result, mode, channel]);

  useEffect(() => {
    let cancel = false;
    getDashboard().then((data) => { if (!cancel) setPriority(data.priorityPairs); }).catch(() => {});
    return () => { cancel = true; };
  }, [version]);

  async function process(raw: string) {
    const text = raw.trim();
    if (!text) return;
    const now = Date.now();
    if (last.current.code === text && now - last.current.at < 1200) return;
    last.current = { code: text, at: now };
    try {
      const response = await scanPair(text, mode, channel);
      setResult({
        ok: true,
        title: response.message,
        detail: `${response.pair.referenceCode} · ${response.pair.name} · ${response.pair.color} · Talla ${response.pair.size}`,
        pair: response.pair,
      });
      beep(true);
      bump();
    } catch (caught) {
      setResult({
        ok: false,
        title: caught instanceof Error ? caught.message : 'No se pudo leer el código.',
        detail: title,
      });
      beep(false);
    }
  }

  async function pump() {
    if (working.current) return;
    working.current = true;
    while (queue.current.length) {
      const next = queue.current.shift();
      if (next) await process(next);
    }
    working.current = false;
    inputRef.current?.focus();
  }

  function enqueue(raw: string) {
    queue.current.push(raw);
    void pump();
  }

  useEffect(() => {
    if (!cameraOn) return;
    let active = true;
    let scanner: { stop: () => Promise<void> } | null = null;
    (async () => {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
      if (!active) return;
      const instance = new Html5Qrcode('barcode-reader', {
        formatsToSupport: [Html5QrcodeSupportedFormats.CODE_128, Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      scanner = instance;
      await instance.start(
        { facingMode: 'environment' },
        { fps: 8, qrbox: { width: 280, height: 120 } },
        (text) => enqueue(text),
        () => {},
      );
    })().catch((caught: unknown) => {
      if (!active) return;
      setCameraError(caught instanceof Error ? caught.message : 'No se pudo abrir la cámara.');
      setCameraOn(false);
    });
    return () => {
      active = false;
      scanner?.stop().catch(() => {});
    };
  }, [cameraOn]);

  return (
    <div className={`stack page scanner-page ${mode} ${channel || ''}`}>
      <PageHeader eyebrow="Operación" title={title} text="La pistola lectora escribe el código y presiona Enter. También puedes activar la cámara de este equipo." />
      <p className={mode === 'devolucion' ? 'mode-note return' : 'mode-note'}>{note}</p>
      <section className="split scanner-grid">
        <article className="panel">
          <form onSubmit={(event) => { event.preventDefault(); enqueue(code); setCode(''); }}>
            <label className="field">
              <span>Código leído</span>
              <input
                ref={inputRef}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  enqueue(code);
                  setCode('');
                }}
                placeholder="Escanea o escribe el código"
                autoFocus
                autoComplete="off"
              />
            </label>
            <button className="btn primary" type="submit">
              {mode === 'salida' ? `Registrar salida a ${channel === 'dropi' ? 'Dropi' : 'páginas'}` : 'Registrar devolución'}
            </button>
          </form>
          {result && (
            <div className={result.ok ? 'scan-result ok' : 'scan-result err'}>
              <strong>{result.pair?.qrCode || 'Atención'}</strong>
              <b>{result.title}</b>
              <span>{result.detail}</span>
              {result.pair && <StatusPill status={result.pair.status} channel={result.pair.channel} />}
            </div>
          )}
          <div className="camera-box">
            <button type="button" className="btn" onClick={() => { setCameraError(''); setCameraOn((current) => !current); }}>
              {cameraOn ? 'Apagar cámara' : 'Activar cámara'}
            </button>
            {cameraError && <p className="form-error">{cameraError}</p>}
            {cameraOn && <div id="barcode-reader" />}
          </div>
        </article>
        <article className="panel">
          <header className="panel-head">
            <h2>Pares prioritarios</h2>
            <span>{priority.length}</span>
          </header>
          {priority.length === 0 ? (
            <div className="empty compact"><p>No hay pares devueltos esperando salir.</p></div>
          ) : (
            <div className="queue">
              {priority.map((pair) => (
                <div className="queue-item" key={pair.id}>
                  <strong>{pair.qrCode}</strong>
                  <div>
                    <b>{pair.referenceCode}</b>
                    <span>{pair.name} · {pair.color} · Talla {pair.size}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
