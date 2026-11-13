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

export function CityPicker({ city, department, cityCode = '', disabled, onPick }: Props) {
  const [query, setQuery] = useState(city ? (department ? `${city} — ${department}` : city) : '');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const selected = cityCode ? findColombiaCity(cityCode) : (city ? findColombiaCity(`${city}, ${department}`) : null);
    if (selected) {
      setQuery(cityOptionLabel(selected));
      return;
    }
    if (!city) {
      setQuery('');
      return;
    }
    setQuery(department ? `${city} — ${department}` : city);
  }, [city, department, cityCode]);

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 1) return COLOMBIA_CITIES.slice(0, 40);
    return COLOMBIA_CITIES
      .filter((item) => (
        item.city.toLowerCase().includes(q)
        || item.department.toLowerCase().includes(q)
        || cityOptionLabel(item).toLowerCase().includes(q)
        || item.code.includes(q)
      ))
      .slice(0, 80);
  }, [query]);

  function pick(item: ColombiaCity) {
    setQuery(cityOptionLabel(item));
    setOpen(false);
    onPick({ city: item.city, department: item.department, code: item.code });
  }

  return (
    <div className="city-picker" ref={rootRef}>
      <label className="field">
        <span>Ciudad / municipio</span>
        <input
          value={query}
          disabled={disabled}
          placeholder="Escribe para buscar en toda Colombia…"
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            if (!event.target.value.trim()) {
              onPick({ city: '', department: '', code: '' });
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
            if (event.key === 'Enter' && matches[0]) {
              event.preventDefault();
              pick(matches[0]);
            }
          }}
        />
      </label>
      {open && !disabled && (
        <div className="city-picker-menu" role="listbox" aria-label="Municipios de Colombia">
          {!matches.length && <p className="city-picker-empty">Sin coincidencias</p>}
          {matches.map((item) => (
            <button
              key={item.code}
              type="button"
              className="city-picker-option"
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
