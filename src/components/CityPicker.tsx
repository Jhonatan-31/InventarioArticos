import { useEffect, useMemo, useRef, useState } from 'react';
import {
  COLOMBIA_CITIES,
  cityOptionLabel,
  findColombiaCity,
  type ColombiaCity,
} from '../data/colombia';

type Props = {
  city: string;
  department: string;
  cityCode?: string;
  disabled?: boolean;
  onPick: (next: { city: string; department: string; code: string }) => void;
};

const ALL_CITIES = [...COLOMBIA_CITIES].sort(
  (a, b) => a.city.localeCompare(b.city, 'es') || a.department.localeCompare(b.department, 'es'),
);

export function CityPicker({ city, department, cityCode = '', disabled, onPick }: Props) {
  const selected = cityCode
    ? findColombiaCity(cityCode)
    : (city ? findColombiaCity(`${city}, ${department}`) || findColombiaCity(city) : null);
  const selectedLabel = selected
    ? cityOptionLabel(selected)
    : (city ? (department ? `${city} — ${department}` : city) : '');

  const [query, setQuery] = useState(selectedLabel);
  const [open, setOpen] = useState(false);
  const [browsing, setBrowsing] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setQuery(selectedLabel);
    setBrowsing(true);
  }, [selectedLabel]);

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setBrowsing(true);
        setQuery(selectedLabel);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [selectedLabel]);

  const matches = useMemo(() => {
    if (browsing) return ALL_CITIES;
    const q = query.trim().toLowerCase();
    if (!q) return ALL_CITIES;
    return ALL_CITIES.filter((item) => (
      item.city.toLowerCase().includes(q)
      || item.department.toLowerCase().includes(q)
      || cityOptionLabel(item).toLowerCase().includes(q)
      || item.code.includes(q)
    ));
  }, [browsing, query]);

  function pick(item: ColombiaCity) {
    setQuery(cityOptionLabel(item));
    setBrowsing(true);
    setOpen(false);
    onPick({ city: item.city, department: item.department, code: item.code });
  }

  return (
    <div className="city-picker" ref={rootRef}>
      <label className="field">
        <span>Ciudad / municipio</span>
        <input
          ref={inputRef}
          value={query}
          disabled={disabled}
          placeholder="Buscar o elegir municipio de Colombia…"
          autoComplete="off"
          onFocus={() => {
            setOpen(true);
            setBrowsing(true);
            setQuery(selectedLabel);
            requestAnimationFrame(() => inputRef.current?.select());
          }}
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            setBrowsing(false);
            setOpen(true);
            if (!value.trim()) {
              onPick({ city: '', department: '', code: '' });
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setOpen(false);
              setBrowsing(true);
              setQuery(selectedLabel);
            }
            if (event.key === 'Enter' && matches[0]) {
              event.preventDefault();
              pick(matches[0]);
            }
          }}
        />
      </label>
      {open && !disabled && (
        <div className="city-picker-menu" role="listbox" aria-label={`Municipios de Colombia (${matches.length})`}>
          <div className="city-picker-meta">{matches.length} de {ALL_CITIES.length} municipios</div>
          {!matches.length && <p className="city-picker-empty">Sin coincidencias</p>}
          {matches.map((item) => (
            <button
              key={item.code}
              type="button"
              className={`city-picker-option${selected?.code === item.code ? ' active' : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(item)}
            >
              <strong>{item.city}</strong>
              <span>{item.department}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
