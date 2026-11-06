import { useEffect, useState } from 'react';
import { getIncidents, getMovements } from '../api';
import type { Incident, Movement } from '../types';
import { formatWhen } from '../format';
import { useUi } from '../ui';
import { PageHeader } from '../components/PageHeader';
import { MovementPill } from '../components/StatusPill';

export function Incidents() {
  const { version, openDamage, openPrint } = useUi();
  const [items, setItems] = useState<Incident[]>([]);
  const [moves, setMoves] = useState<Movement[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancel = false;
    Promise.all([getIncidents(), getMovements()]).then(([incidents, movements]) => {
      if (cancel) return;
      setItems(incidents);
      setMoves(movements.filter((item) => item.type === 'novedad' || item.type === 'reimpresion'));
    }).catch((caught: unknown) => {
      if (!cancel) setError(caught instanceof Error ? caught.message : 'No se pudo cargar el historial.');
    });
    return () => { cancel = true; };
  }, [version]);

  return (
    <div className="stack page">
      <PageHeader
        eyebrow="Trazabilidad"
        title="Novedades de código"
        text="Aquí queda por qué se dañó cada etiqueta. Si todavía no se reimprimió, puedes sacar de nuevo el mismo código."
        actions={<button type="button" className="btn danger" onClick={() => openDamage('')}>Registrar código dañado</button>}
      />
      {error && <p className="form-error">{error}</p>}
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Código</th>
              <th>Referencia</th>
              <th>Qué pasó</th>
              <th>Reimpresión</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={6}>No hay novedades registradas.</td></tr>}
            {items.map((item) => (
              <tr key={item.id} className={item.reprintedAt ? '' : 'priority'}>
                <td>{formatWhen(item.createdAt)}</td>
                <td className="mono">{item.qrCode}</td>
                <td>{item.referenceCode}<small>{item.name} · Talla {item.size}</small></td>
                <td>{item.description}</td>
                <td>{item.reprintedAt ? formatWhen(item.reprintedAt) : 'Pendiente'}</td>
                <td>
                  {!item.reprintedAt && (
                    <button type="button" className="btn small" onClick={() => openPrint([item.pairId])}>Imprimir</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <article className="panel">
        <header className="panel-head"><h2>Historial de novedades y reimpresiones</h2></header>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Código</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {moves.length === 0 && <tr><td colSpan={4}>Sin registros.</td></tr>}
              {moves.map((move) => (
                <tr key={move.id}>
                  <td>{formatWhen(move.createdAt)}</td>
                  <td><MovementPill type={move.type} /></td>
                  <td className="mono">{move.qrCode}</td>
                  <td>{move.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
