import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { getSession, login } from '../api';

export function AccessGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'loading' | 'open' | 'locked'>('loading');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getSession()
      .then((session) => {
        if (alive) setState(session.required && !session.ok ? 'locked' : 'open');
      })
      .catch(() => {
        if (alive) setState('open');
      });
    return () => {
      alive = false;
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

  if (state === 'loading') {
    return (
      <main className="gate">
        <p>Abriendo inventario…</p>
      </main>
    );
  }

  if (state === 'locked') {
    return (
      <main className="gate">
        <form className="gate-card" onSubmit={submit}>
          <p className="eyebrow">Calzado Evalook</p>
          <h1>Inventario</h1>
          <p className="lede">Entra con la clave del almacén.</p>
          <label className="field">
            Clave
            <input
              autoFocus
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </main>
    );
  }

  return children;
}
