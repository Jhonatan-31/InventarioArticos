import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getPairs } from '../api';
import type { Pair } from '../types';
import { useUi } from '../ui';
import { PageHeader } from '../components/PageHeader';
import { LabelPill } from '../components/StatusPill';

export function Labels() {
  const { version, openPrint, openDamage } = useUi();
  const [params] = useSearchParams();
  const [items, setItems] = useState<Pair[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState('');
  const opened = useRef(false);

  useEffect(() => {
    const ids = params.get('ids');
    if (!ids || opened.current) return;
    opened.current = true;
    openPrint(ids.split(',').filter(Boolean));
  }, [params, openPrint]);

  useEffect(() => {
    let cancel = false;
    getPairs({ status: 'todos', printable: '1', page: '1', pageSize: '100' }).then((result) => {
      if (!cancel) setItems(result.items);
    }).catch((caught: unknown) => {
      if (!cancel) setError(caught instanceof Error ? caught.message : 'No se pudieron cargar las etiquetas.');
    });
    return () => { cancel = true; };
  }, [version]);

  return (
    <div className="stack page">
      <PageHeader
        eyebrow="Impresión"
        title="Etiquetas"
        text="La primera impresión queda libre. Si el código ya se confirmó y se daña, primero se registra la novedad y después se imprime el mismo número."
        actions={
          <>
            <button type="button" className="btn" disabled={selected.length === 0} onClick={() => openPrint(selected)}>Imprimir selección</button>
            <button type="button" className="btn danger" onClick={() => openDamage('')}>Código dañado</button>
          </>
        }
      />
      <section className="callout">
        <div>
          <strong>Confirma cuando ya estén pegadas</strong>
          <p>Mientras no confirmes, puedes volver a imprimir. Después, el sistema solo suelta otra copia del mismo código si explicas qué pasó.</p>
        </div>
      </section>
      {error && <p className="form-error">{error}</p>}
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th></th>
              <th>Código</th>
              <th>Referencia</th>
              <th>Par</th>
              <th>Situación</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={5}>No hay etiquetas pendientes de imprimir o reimprimir.</td></tr>}
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.includes(item.id)}
                    onChange={() => setSelected((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])}
                    aria-label={`Seleccionar ${item.qrCode}`}
                  />
                </td>
                <td className="mono">{item.qrCode}</td>
                <td>{item.referenceCode}</td>
                <td>{item.name}<small>{item.color} · Talla {item.size}</small></td>
                <td><LabelPill state={item.labelState} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
