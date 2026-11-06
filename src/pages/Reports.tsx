import { useEffect, useState } from 'react';
import { downloadExcel, getDashboard } from '../api';
import type { DashboardData } from '../types';
import { formatMoney } from '../format';
import { useUi } from '../ui';
import { PageHeader } from '../components/PageHeader';

const sheets = [
  ['Resumen', 'Indicadores del día, valor en bodega y saldos.'],
  ['Bodega', 'Existencia por referencia, color y talla.'],
  ['En existencia', 'Pares disponibles, con los prioritarios marcados.'],
  ['Prioritarios', 'Devueltos que deben salir primero.'],
  ['Salidas', 'Pares que ya no están en inventario, con su canal.'],
  ['Referencias', 'Catálogo con precio y valor.'],
  ['Rotación', 'Salidas y devoluciones acumuladas.'],
  ['Movimientos', 'Entradas, salidas, devoluciones, novedades y reimpresiones.'],
  ['Contabilidad', 'Lo que se debe en páginas y en Dropi.'],
  ['Abonos', 'Pagos registrados a cada canal.'],
  ['Novedades', 'Qué pasó con cada código dañado y si ya se reimprimió.'],
];

export function Reports() {
  const { version, notify } = useUi();
  const [data, setData] = useState<DashboardData | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancel = false;
    getDashboard().then((next) => { if (!cancel) setData(next); }).catch(() => {});
    return () => { cancel = true; };
  }, [version]);

  async function download() {
    setBusy(true);
    try {
      await downloadExcel();
      notify('Informe descargado.', 'ok');
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'No se pudo descargar el informe.', 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack page">
      <PageHeader
        eyebrow="Excel"
        title="Informe de inventario"
        text="Un libro listo para imprimir o enviar: encabezado de Calzado Evalook, filtros, totales y el detalle de cada par."
        actions={<button type="button" className="btn primary" onClick={download} disabled={busy}>{busy ? 'Generando…' : 'Descargar Excel'}</button>}
      />
      {data && (
        <section className="kpi-grid">
          <article className="kpi"><span>Existencia</span><strong>{data.totals.inStock}</strong></article>
          <article className="kpi accent"><span>Prioritarios</span><strong>{data.totals.priority}</strong></article>
          <article className="kpi"><span>Plata en bodega</span><strong className="money-kpi">{formatMoney(data.totals.warehouseValue)}</strong></article>
          <article className="kpi"><span>Saldo páginas</span><strong className="money-kpi">{formatMoney(data.totals.paginasBalance)}</strong></article>
          <article className="kpi"><span>Saldo Dropi</span><strong className="money-kpi">{formatMoney(data.totals.dropiBalance)}</strong></article>
        </section>
      )}
      <section className="sheet-grid">
        {sheets.map(([name, text]) => (
          <article key={name} className="sheet-card">
            <span>Hoja</span>
            <strong>{name}</strong>
            <p>{text}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
