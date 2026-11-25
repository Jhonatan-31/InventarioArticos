import { useEffect, useRef, useState } from 'react';
import { lookupCarriers, refreshCarriers, searchCarrierCities } from '../api';
import type { CarrierLookupResponse, CarrierCitySuggestion } from '../types';
import { PageHeader } from '../components/PageHeader';
import { useUi } from '../ui';

function formatUpdatedAt(iso: string | null) {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'America/Bogota',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function Transportadoras() {
  const { notify } = useUi();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<CarrierCitySuggestion[]>([]);
  const [suggestTotal, setSuggestTotal] = useState(0);
  const [selected, setSelected] = useState('');
  const [result, setResult] = useState<CarrierLookupResponse | null>(null);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoadingSuggest(true);
      try {
        const data = await searchCarrierCities(query, false, controller.signal);
        setSuggestions(data.items);
        setSuggestTotal(data.total);
        if (data.warning) setWarning(data.warning);
      } catch (caught) {
        if ((caught as Error)?.name === 'AbortError') return;
        setSuggestions([]);
        setSuggestTotal(0);
      } finally {
        setLoadingSuggest(false);
      }
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, open]);

  async function runLookup(city: string, refresh = false) {
    const name = city.trim();
    if (!name) return;
    setLoadingLookup(true);
    setError('');
    setOpen(false);
    try {
      const data = await lookupCarriers(name, refresh);
      setResult(data);
      setSelected(data.city);
      setQuery(data.city);
      setWarning(data.warning);
    } catch (caught) {
      setResult(null);
      setError(caught instanceof Error ? caught.message : 'No se pudo consultar el semáforo.');
    } finally {
      setLoadingLookup(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    setError('');
    try {
      await refreshCarriers();
      notify('Semáforo actualizado desde Drive.', 'ok');
      if (selected) await runLookup(selected, true);
      else if (open) {
        const data = await searchCarrierCities(query, true);
        setSuggestions(data.items);
        setSuggestTotal(data.total);
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No se pudo refrescar el semáforo.';
      setError(message);
      notify(message, 'err');
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="stack page carriers-page">
      <PageHeader
        eyebrow="Cuentas"
        title="Transportadoras"
        text="Busca el municipio y ve solo las transportadoras con envío, ordenadas por mejor probabilidad según el semáforo de Dropi."
        actions={(
          <button
            type="button"
            className="btn ghost"
            disabled={refreshing || loadingLookup}
            onClick={() => void onRefresh()}
          >
            {refreshing ? 'Actualizando…' : 'Actualizar semáforo'}
          </button>
        )}
      />

      {warning && <p className="carriers-warning">{warning}</p>}
      {error && <p className="form-error">{error}</p>}

      <section className="panel carriers-search-panel">
        <header className="panel-head">
          <h2>Municipio</h2>
          {result?.updatedAt && (
            <span>Datos: {formatUpdatedAt(result.updatedAt)}</span>
          )}
        </header>

        <div className="carriers-picker" ref={rootRef}>
          <label className="field">
            <span>Buscar municipio</span>
            <input
              ref={inputRef}
              value={query}
              placeholder="Escribe el municipio… ej. Bogotá, Medellín"
              autoComplete="off"
              onFocus={() => setOpen(true)}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
                if (!event.target.value.trim()) {
                  setResult(null);
                  setSelected('');
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setOpen(false);
                if (event.key === 'Enter') {
                  event.preventDefault();
                  const first = suggestions[0]?.city || query;
                  void runLookup(first);
                }
              }}
            />
          </label>
          {open && (
            <div className="carriers-menu" role="listbox" aria-label="Municipios del semáforo">
              <div className="carriers-menu-meta">
                {loadingSuggest
                  ? 'Buscando…'
                  : `${suggestions.length}${suggestTotal > suggestions.length ? ` de ${suggestTotal}` : ''} municipios`}
              </div>
              {!loadingSuggest && !suggestions.length && (
                <p className="carriers-menu-empty">Sin coincidencias en el semáforo</p>
              )}
              {suggestions.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`carriers-option${selected === item.city ? ' active' : ''}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => void runLookup(item.city)}
                >
                  <strong>{item.city}</strong>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {loadingLookup && (
        <p className="muted carriers-loading">Consultando transportadoras…</p>
      )}

      {result && !loadingLookup && (
        <section className="panel carriers-results">
          <header className="panel-head">
            <h2>{result.city}</h2>
            <span>
              {result.available
                ? `${result.available} con envío`
                : 'Sin cobertura'}
            </span>
          </header>

          {!result.carriers.length ? (
            <p className="carriers-empty">Sin envío disponible para ese municipio</p>
          ) : (
            <ul className="carriers-list">
              {result.carriers.map((carrier, index) => (
                <li key={carrier.name} className={`carriers-row level-${carrier.level}`}>
                  <div className="carriers-row-main">
                    <span className="carriers-rank">{index + 1}</span>
                    <div>
                      <strong>{carrier.name}</strong>
                      <p>{carrier.label}</p>
                    </div>
                  </div>
                  <div className="carriers-row-meta">
                    <span className={`pill carrier-${carrier.level}`}>{carrier.level}</span>
                    <small>{carrier.range}</small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
