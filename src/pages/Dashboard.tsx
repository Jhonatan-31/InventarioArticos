import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDashboard, getPairs } from '../api';
import type { DashboardData, Pair } from '../types';
import { formatMoney, formatWhen } from '../format';
import { useUi } from '../ui';
import { PageHeader } from '../components/PageHeader';
import { MovementPill, StatusPill } from '../components/StatusPill';

type Scope = 'todos' | 'bodega' | 'paginas' | 'dropi';

const SCOPE_OPTIONS: Array<{ key: Scope; label: string }> = [
  { key: 'todos', label: 'Todos' },
  { key: 'bodega', label: 'Bodega' },
  { key: 'paginas', label: 'Páginas' },
  { key: 'dropi', label: 'Dropi' },
];

export function Dashboard() {
  const { version } = useUi();
  const [data, setData] = useState<DashboardData | null>(null);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [pairsTotal, setPairsTotal] = useState(0);
  const [scope, setScope] = useState<Scope>('todos');
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

  useEffect(() => {
    let cancel = false;
    const status = scope === 'todos' ? 'salida' : scope === 'bodega' ? 'existencia' : scope;
    getPairs({ status, page: '1', pageSize: '25' }).then((result) => {
      if (cancel) return;
      setPairs(result.items);
      setPairsTotal(result.total);
    }).catch(() => {
      if (!cancel) {
        setPairs([]);
        setPairsTotal(0);
      }
    });
    return () => { cancel = true; };
  }, [version, scope]);

  const ranked = useMemo(() => (
    [...(data?.byReference || [])].sort((a, b) => b.inStock - a.inStock || a.code.localeCompare(b.code)).slice(0, 8)
  ), [data]);
  const max = Math.max(1, ...ranked.map((item) => item.inStock));

  const movements = useMemo(() => {
    const rows = data?.recentMovements || [];
    if (scope === 'todos') return rows;
    if (scope === 'bodega') return rows.filter((move) => move.type === 'entrada' || move.type === 'devolucion');
    if (scope === 'paginas') return rows.filter((move) => move.type === 'salida' && move.channel === 'paginas');
    return rows.filter((move) => move.type === 'salida' && move.channel === 'dropi');
  }, [data, scope]);

  const scopeTitle = {
    todos: 'Lo que ha salido',
    bodega: 'Lo que hay en bodega',
    paginas: 'Salidas a páginas',
    dropi: 'Salidas a Dropi',
  }[scope];

  const scopeHint = {
    todos: 'Últimas salidas de bodega, sin importar el canal.',
    bodega: 'Pares que siguen en inventario, incluidos prioritarios.',
    paginas: 'Pares que salieron por el canal de páginas.',
    dropi: 'Pares que salieron por Dropi.',
  }[scope];

  const scopeLink = {
    todos: '/pares?estado=salida',
    bodega: '/pares?estado=existencia',
    paginas: '/pares?estado=paginas',
    dropi: '/pares?estado=dropi',
  }[scope];

  return (
    <div className="stack page">
      <PageHeader
        eyebrow="Calzado Evalook"
        title="Panel de inventario"
        text="Existencia por talla, salidas separadas para páginas y Dropi, y la plata que queda en bodega o por cobrar."
      />

      <div className="panel filter-panel">
        <div className="inventory-toolbar">
          <span className="filter-caption">Ver</span>
          <div className="filter-ranges" role="tablist" aria-label="Filtro del panel">
            {SCOPE_OPTIONS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={scope === item.key ? 'active' : ''}
                onClick={() => setScope(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <Link className="btn ghost" to={scopeLink}>Ver listado</Link>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}
      {!data && !error && <p className="muted">Cargando el panel…</p>}
      {data && (
        <>
          <section className="kpi-grid">
            <article className={`kpi${scope === 'bodega' ? ' accent' : ''}`}>
              <span>En existencia</span>
              <strong>{data.totals.inStock}</strong>
              <small>Incluye prioritarios</small>
            </article>
            <article className={`kpi${scope === 'todos' && data.totals.priority > 0 ? ' accent' : ''}`}>
              <span>Prioritarios</span>
              <strong>{data.totals.priority}</strong>
              <small>Devueltos, salen primero</small>
            </article>
            <article className={`kpi${scope === 'paginas' ? ' accent' : ''}`}>
              <span>Salieron a páginas</span>
              <strong>{data.totals.outPaginas}</strong>
              <small>Saldo {formatMoney(data.totals.paginasBalance)}</small>
            </article>
            <article className={`kpi${scope === 'dropi' ? ' accent' : ''}`}>
              <span>Salieron a Dropi</span>
              <strong>{data.totals.outDropi}</strong>
              <small>Saldo {formatMoney(data.totals.dropiBalance)}</small>
            </article>
          </section>
          <section className="kpi-grid">
            <article className="kpi">
              <span>Plata en bodega</span>
              <strong className="money-kpi">{formatMoney(data.totals.warehouseValue)}</strong>
              <small>Precio por existencia</small>
            </article>
            <article className="kpi">
              <span>Salieron en total</span>
              <strong>{data.totals.out}</strong>
              <small>Fuera de inventario</small>
            </article>
            <article className="kpi">
              <span>Referencias</span>
              <strong>{data.totals.references}</strong>
              <small>Siguiente código {data.nextQr}</small>
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

          <article className="panel">
            <header className="panel-head">
              <div>
                <h2>{scopeTitle}</h2>
                <p className="lede">{scopeHint}</p>
              </div>
              <Link to={scopeLink}>Ver todos ({pairsTotal})</Link>
            </header>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Referencia</th>
                    <th>Detalle</th>
                    <th>Estado</th>
                    <th>Ingreso</th>
                    <th>Salida</th>
                  </tr>
                </thead>
                <tbody>
                  {pairs.length === 0 && (
                    <tr>
                      <td colSpan={6}>
                        {scope === 'bodega'
                          ? 'No hay pares en bodega.'
                          : scope === 'paginas'
                            ? 'Todavía no hay salidas a páginas.'
                            : scope === 'dropi'
                              ? 'Todavía no hay salidas a Dropi.'
                              : 'Todavía no hay salidas registradas.'}
                      </td>
                    </tr>
                  )}
                  {pairs.map((item) => (
                    <tr key={item.id} className={item.status === 'prioridad' ? 'priority' : ''}>
                      <td className="mono">{item.qrCode}</td>
                      <td>{item.referenceCode}</td>
                      <td>{item.name}<small>{item.color} · Talla {item.size}</small></td>
                      <td><StatusPill status={item.status} channel={item.channel} /></td>
                      <td>{formatWhen(item.createdAt)}</td>
                      <td>{formatWhen(item.exitedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

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
                  <p>Crea la primera referencia y luego ingresa los pares por talla. El código inicial será 00001.</p>
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
                  {movements.length === 0 && (
                    <tr><td colSpan={5}>No hay movimientos con este filtro.</td></tr>
                  )}
                  {movements.map((move) => (
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
