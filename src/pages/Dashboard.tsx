import { useEffect, useState } from 'react';
import { getDashboard } from '../api';
import type { DashboardData } from '../types';
import { formatMoney, formatWhen } from '../format';
import { useUi } from '../ui';
import { PageHeader } from '../components/PageHeader';
import { MovementPill, StatusPill } from '../components/StatusPill';
import { Link } from 'react-router-dom';

export function Dashboard() {
  const { version, openDamage } = useUi();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancel = false;
    getDashboard().then((next) => {
      if (!cancel) setData(next);
    }).catch((caught: unknown) => {
      if (!cancel) setError(caught instanceof Error ? caught.message : 'No se pudo cargar el panel.');
    });
    return () => { cancel = true; };
  }, [version]);

  const ranked = [...(data?.byReference || [])].sort((a, b) => b.inStock - a.inStock || a.code.localeCompare(b.code)).slice(0, 8);
  const max = Math.max(1, ...ranked.map((item) => item.inStock));

  return (
    <div className="stack page">
      <PageHeader
        eyebrow="Calzado Evalook"
        title="Panel de inventario"
        text="Existencia por talla, salidas separadas para páginas y Dropi, y la plata que queda en bodega o por cobrar."
        actions={<button type="button" className="btn danger" onClick={() => openDamage('')}>Código dañado</button>}
      />
      {error && <p className="form-error">{error}</p>}
      {!data && !error && <p className="muted">Cargando el panel…</p>}
      {data && (
        <>
          <section className="kpi-grid">
            <article className="kpi">
              <span>En existencia</span>
              <strong>{data.totals.inStock}</strong>
              <small>Incluye prioritarios</small>
            </article>
            <article className="kpi accent">
              <span>Prioritarios</span>
              <strong>{data.totals.priority}</strong>
              <small>Devueltos, salen primero</small>
            </article>
            <article className="kpi">
              <span>Salieron</span>
              <strong>{data.totals.out}</strong>
              <small>Fuera de inventario</small>
            </article>
            <article className="kpi">
              <span>Referencias</span>
              <strong>{data.totals.references}</strong>
              <small>Siguiente código {data.nextQr}</small>
            </article>
          </section>
          <section className="kpi-grid">
            <article className="kpi">
              <span>Plata en bodega</span>
              <strong className="money-kpi">{formatMoney(data.totals.warehouseValue)}</strong>
              <small>Precio por existencia</small>
            </article>
            <article className="kpi">
              <span>Saldo páginas</span>
              <strong className="money-kpi">{formatMoney(data.totals.paginasBalance)}</strong>
              <small>{data.totals.outPaginas} pares fuera</small>
            </article>
            <article className="kpi">
              <span>Saldo Dropi</span>
              <strong className="money-kpi">{formatMoney(data.totals.dropiBalance)}</strong>
              <small>{data.totals.outDropi} pares fuera</small>
            </article>
            <article className="kpi accent">
              <span>Por cobrar</span>
              <strong className="money-kpi">{formatMoney(data.totals.paginasOwed + data.totals.dropiOwed)}</strong>
              <small>Antes de abonos</small>
            </article>
          </section>
          <section className="today-grid">
            <div><span>Entradas hoy</span><b>{data.totals.entriesToday}</b></div>
            <div><span>Salidas hoy</span><b>{data.totals.exitsToday}</b></div>
            <div><span>Devoluciones hoy</span><b>{data.totals.returnsToday}</b></div>
            <div><span>Novedades abiertas</span><b>{data.totals.incidentsOpen}</b></div>
          </section>
          <section className="split">
            <article className="panel">
              <header className="panel-head">
                <h2>Existencia por referencia</h2>
                <div className="legend">
                  <span><i className="swatch stock" /> Normal</span>
                  <span><i className="swatch priority" /> Prioritario</span>
                </div>
              </header>
              {ranked.length === 0 ? (
                <div className="empty">
                  <strong>Todavía no hay referencias</strong>
                  <p>Crea la primera y registra los pares. El código inicial será 00001.</p>
                  <Link className="btn primary" to="/referencias">Crear referencia</Link>
                </div>
              ) : (
                <div className="bars">
                  {ranked.map((item) => (
                    <div className="bar-row" key={item.id}>
                      <div className="bar-label">
                        <strong>{item.code}</strong>
                        <span>{item.name} · {item.color}</span>
                      </div>
                      <div className="bar-track" aria-hidden="true">
                        <span className="bar priority" style={{ width: `${(item.priority / max) * 100}%` }} />
                        <span className="bar stock" style={{ width: `${((item.inStock - item.priority) / max) * 100}%` }} />
                      </div>
                      <b>{item.inStock}</b>
                    </div>
                  ))}
                </div>
              )}
            </article>
            <article className="panel">
              <header className="panel-head">
                <h2>Salen primero</h2>
                <Link to="/pares?estado=prioridad">Ver todos</Link>
              </header>
              {data.priorityPairs.length === 0 ? (
                <div className="empty compact">
                  <p>No hay pares prioritarios. Aparecen aquí cuando un par sale y luego se devuelve.</p>
                </div>
              ) : (
                <div className="queue">
                  {data.priorityPairs.map((pair) => (
                    <div key={pair.id} className="queue-item">
                      <strong>{pair.qrCode}</strong>
                      <div>
                        <b>{pair.referenceCode}</b>
                        <span>{pair.name} · Talla {pair.size}</span>
                      </div>
                      <StatusPill status={pair.status} />
                    </div>
                  ))}
                </div>
              )}
            </article>
          </section>
          <article className="panel">
            <header className="panel-head">
              <h2>Rotación por referencia</h2>
            </header>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Referencia</th>
                    <th>Modelo</th>
                    <th>Existencia</th>
                    <th>Prioritarios</th>
                    <th>Salidas</th>
                    <th>Devoluciones</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byReference.length === 0 && (
                    <tr><td colSpan={6}>Sin movimientos todavía.</td></tr>
                  )}
                  {[...data.byReference].sort((a, b) => b.exits - a.exits || a.code.localeCompare(b.code)).map((item) => (
                    <tr key={item.id} className={item.priority > 0 ? 'priority' : ''}>
                      <td className="mono">{item.code}</td>
                      <td>{item.name}<small>{item.color} · {formatMoney(item.price)}</small></td>
                      <td>{item.inStock}</td>
                      <td>{item.priority}</td>
                      <td>{item.exits}</td>
                      <td>{item.returns}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
          <article className="panel">
            <header className="panel-head">
              <h2>Últimos movimientos</h2>
              <Link to="/novedades">Novedades</Link>
            </header>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Código</th>
                    <th>Referencia</th>
                    <th>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentMovements.length === 0 && (
                    <tr><td colSpan={5}>Aún no hay movimientos.</td></tr>
                  )}
                  {data.recentMovements.map((move) => (
                    <tr key={move.id}>
                      <td>{formatWhen(move.createdAt)}</td>
                      <td><MovementPill type={move.type} /></td>
                      <td className="mono">{move.qrCode}</td>
                      <td>{move.referenceCode}<small>{move.name}</small></td>
                      <td>{move.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </>
      )}
    </div>
  );
}
