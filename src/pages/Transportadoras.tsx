import { useEffect, useMemo, useRef, useState } from 'react';
import { lookupCarriers, refreshCarriers, searchCarrierCities } from '../api';
import type { CarrierLevel, CarrierLookupResponse, CarrierCitySuggestion } from '../types';
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

function levelTone(level: CarrierLevel) {
  if (level === 'alto') return { short: 'Alto', meter: 100 };
  if (level === 'medio') return { short: 'Medio', meter: 68 };
  return { short: 'Bajo', meter: 42 };
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

  const levelCounts = useMemo(() => {
    const counts = { alto: 0, medio: 0, bajo: 0 };
    (result?.carriers || []).forEach((item) => { counts[item.level] += 1; });
    return counts;
  }, [result]);

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
        text="Consulta el semáforo de entregas por municipio. Solo aparecen transportadoras con cobertura."
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

      <section className="carriers-hero">
        <div className="carriers-hero-copy">
          <p className="carriers-kicker">Semáforo Dropi</p>
          <h2>¿A dónde envías?</h2>
          <p>Escribe el municipio y elige en la lista. El resultado usa los mismos colores del Drive.</p>
        </div>

        <div className="carriers-legend" aria-label="Leyenda del semáforo">
          <span className="carriers-legend-item tone-alto"><i /> Mejor · &gt;70%</span>
          <span className="carriers-legend-item tone-medio"><i /> Medio · 65–69.9%</span>
          <span className="carriers-legend-item tone-bajo"><i /> Por mejorar · &lt;65%</span>
          <span className="carriers-legend-item tone-off"><i /> Sin envío · no se muestra</span>
        </div>

        <div className="carriers-picker" ref={rootRef}>
          <label className="field carriers-search-field">
            <span>Municipio</span>
            <input
              ref={inputRef}
              value={query}
              placeholder="Bogotá, Medellín, Cali…"
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
                  ? 'Buscando municipios…'
                  : `${suggestions.length}${suggestTotal > suggestions.length ? ` de ${suggestTotal}` : ''} coincidencias`}
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
                  <span>Consultar cobertura</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {(result?.updatedAt || loadingLookup) && (
          <p className="carriers-sync">
            {loadingLookup
              ? 'Consultando cobertura…'
              : `Última lectura: ${formatUpdatedAt(result?.updatedAt || null)}`}
          </p>
        )}
      </section>

      {loadingLookup && (
        <div className="carriers-skeleton" aria-hidden="true">
          <div className="carriers-skeleton-bar" />
          <div className="carriers-skeleton-row" />
          <div className="carriers-skeleton-row" />
          <div className="carriers-skeleton-row" />
        </div>
      )}

      {result && !loadingLookup && (
        <section className="carriers-results" aria-live="polite">
          <header className="carriers-results-head">
            <div>
              <p className="carriers-kicker">Resultado</p>
              <h2>{result.city}</h2>
            </div>
            <div className="carriers-results-stats">
              <strong>{result.available}</strong>
              <span>{result.available === 1 ? 'transportadora' : 'transportadoras'} con envío</span>
            </div>
          </header>

          {!!result.carriers.length && (
            <div className="carriers-breakdown" aria-label="Resumen por nivel">
              <span className="tone-alto"><b>{levelCounts.alto}</b> alto</span>
              <span className="tone-medio"><b>{levelCounts.medio}</b> medio</span>
              <span className="tone-bajo"><b>{levelCounts.bajo}</b> bajo</span>
            </div>
          )}

          {!result.carriers.length ? (
            <div className="carriers-empty">
              <strong>Sin cobertura</strong>
              <p>Ninguna transportadora del semáforo tiene envío a este municipio.</p>
            </div>
          ) : (
            <ol className="carriers-list">
              {result.carriers.map((carrier, index) => {
                const tone = levelTone(carrier.level);
                return (
                  <li key={carrier.name} className={`carriers-row level-${carrier.level}`}>
                    <div className="carriers-rail" aria-hidden="true" />
                    <div className="carriers-row-body">
                      <div className="carriers-row-main">
                        <span className="carriers-rank">{index + 1}</span>
                        <div className="carriers-row-copy">
                          <strong>{carrier.name}</strong>
                          <p>{carrier.label}</p>
                        </div>
                      </div>
                      <div className="carriers-row-side">
                        <div className={`carriers-badge level-${carrier.level}`}>
                          <i />
                          <span>{tone.short}</span>
                        </div>
                        <small>{carrier.range}</small>
                        <div className="carriers-meter" aria-hidden="true">
                          <span style={{ width: `${tone.meter}%` }} />
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      )}
    </div>
  );
}
