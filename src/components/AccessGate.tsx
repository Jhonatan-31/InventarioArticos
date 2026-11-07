import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { getSession, login } from '../api';

export function AccessGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'checking' | 'open' | 'locked'>('checking');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 2500);

    getSession(controller.signal)
      .then((session) => {
        if (!alive) return;
        if (!session.required || session.ok) setState('open');
        else setState('locked');
      })
      .catch(() => {
        if (alive) setState('locked');
      })
      .finally(() => window.clearTimeout(timer));

    return () => {
      alive = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(password);
      setState('open');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo entrar.');
    } finally {
      setBusy(false);
    }
  }

  if (state === 'open') return children;

  return (
    <main className="gate">
      <form className="gate-card" onSubmit={submit}>
        <p className="eyebrow">Calzado Evalook</p>
        <h1>Inventario</h1>
        <p className="lede">
          {state === 'checking' ? 'Comprobando acceso…' : 'Entra con la clave del almacén.'}
        </p>
        <label className="field">
          Clave
          <input
            autoFocus
            type="password"
            autoComplete="current-password"
            value={password}
            disabled={busy}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="btn primary" type="submit" disabled={busy || !password.trim()}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}
