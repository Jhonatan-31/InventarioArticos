import { useEffect, useState } from 'react';
import { addPayment, getAccounting } from '../api';
import type { AccountingData, Channel, ChannelAccount } from '../types';
import { channelLabel, formatMoney, formatWhen } from '../format';
import { useUi } from '../ui';
import { PageHeader } from '../components/PageHeader';

function AccountCard({ account }: { account: ChannelAccount }) {
  return (
    <article className={`panel account-card ${account.channel}`}>
      <header className="panel-head">
        <h2>{channelLabel[account.channel]}</h2>
        <span>{account.outNow} pares fuera</span>
      </header>
      <dl className="account-lines">
        <div><dt>Valor salido</dt><dd>{formatMoney(account.exitedValue)}</dd></div>
        <div><dt>Devoluciones</dt><dd>{formatMoney(account.returnedValue)}</dd></div>
        <div><dt>Por cobrar</dt><dd>{formatMoney(account.owed)}</dd></div>
        <div><dt>Abonos</dt><dd>{formatMoney(account.paid)}</dd></div>
        <div className="balance"><dt>Saldo</dt><dd>{formatMoney(account.balance)}</dd></div>
      </dl>
      <p className="muted">{account.exits} salidas · {account.returns} devoluciones</p>
    </article>
  );
}

export function Contabilidad() {
  const { version, bump, notify } = useUi();
  const [data, setData] = useState<AccountingData | null>(null);
  const [channel, setChannel] = useState<Channel>('paginas');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancel = false;
    getAccounting().then((next) => { if (!cancel) setData(next); }).catch((caught: unknown) => {
      if (!cancel) setError(caught instanceof Error ? caught.message : 'No se pudo cargar la contabilidad.');
    });
    return () => { cancel = true; };
  }, [version]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const next = await addPayment(channel, Number(amount), note);
      setData(next);
      setAmount('');
      setNote('');
      bump();
      notify(`Abono registrado en ${channelLabel[channel]}.`, 'ok');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo registrar el abono.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack page">
      <PageHeader
        eyebrow="Cuentas"
        title="Contabilidad de salidas"
        text="Cada canal lleva su propia cuenta: páginas, Dropi y fábrica. Lo que salió se carga al precio del par, la devolución lo reversa y el abono baja el saldo."
      />
      {error && <p className="form-error">{error}</p>}
      {data && (
        <section className="accounts-grid">
          <AccountCard account={data.paginas} />
          <AccountCard account={data.dropi} />
          <AccountCard account={data.fabrica} />
        </section>
      )}
      <section className="panel">
        <header className="panel-head"><h2>Registrar abono</h2></header>
        <form className="form-grid" onSubmit={submit}>
          <label className="field">
            <span>Canal</span>
            <select value={channel} onChange={(event) => setChannel(event.target.value as Channel)}>
              <option value="paginas">Páginas</option>
              <option value="dropi">Dropi</option>
              <option value="fabrica">Fábrica</option>
            </select>
          </label>
          <label className="field">
            <span>Valor del abono</span>
            <input inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value.replace(/\D/g, ''))} placeholder="30000" required />
          </label>
          <label className="field">
            <span>Nota</span>
            <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Transferencia, efectivo o consignación" required minLength={3} />
          </label>
          <div className="form-actions">
            <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar abono'}</button>
          </div>
        </form>
      </section>
      <section className="panel">
        <header className="panel-head"><h2>Abonos</h2></header>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Canal</th>
                <th>Abono</th>
                <th>Nota</th>
              </tr>
            </thead>
            <tbody>
              {!data?.payments.length && <tr><td colSpan={4}>Todavía no hay abonos.</td></tr>}
              {data?.payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{formatWhen(payment.createdAt)}</td>
                  <td>{channelLabel[payment.channel]}</td>
                  <td className="money">{formatMoney(payment.amount)}</td>
                  <td>{payment.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
