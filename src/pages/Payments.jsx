import { useMemo, useState } from "react";
import { useData } from "../context/DataContext.jsx";
import { useDialog } from "../context/DialogContext.jsx";
import Pill from "../components/Pill.jsx";
import { fmtDayLong, money, payStatus } from "../lib/format.js";
import { PAY_FILTERS, PAY_COLOR } from "../lib/constants.js";

export default function Payments() {
  const { appts, payments, feeFor, paidFor, balFor } = useData();
  const { openDialog } = useDialog();
  const [filter, setFilter] = useState("All");

  const live = useMemo(() => appts.filter((a) => a.status !== "Cancelled"), [appts]);
  const billed = live.reduce((s, a) => s + feeFor(a.id), 0);
  const collected = payments.reduce((s, p) => s + Number(p.amount), 0);
  const outstanding = live.reduce((s, a) => s + balFor(a.id), 0);
  const unpaid = live.filter((a) => ["Unpaid", "Partial"].includes(payStatus(feeFor(a.id), paidFor(a.id)))).length;

  const rows = live
    .filter((a) => filter === "All" || payStatus(feeFor(a.id), paidFor(a.id)) === filter)
    .sort((x, y) => new Date(y.start_at) - new Date(x.start_at));

  return (
    <>
      <h1 className="page-title">Payments</h1>
      <div className="stats">
        <div className="stat"><div className="stat-bar blue" /><div className="stat-val">{money(billed)}</div><div className="stat-lbl">Total billed</div></div>
        <div className="stat"><div className="stat-bar green" /><div className="stat-val">{money(collected)}</div><div className="stat-lbl">Total collected</div></div>
        <div className="stat"><div className="stat-bar amber" /><div className="stat-val">{money(outstanding)}</div><div className="stat-lbl">Balance due</div></div>
        <div className="stat"><div className="stat-bar red" /><div className="stat-val">{unpaid}</div><div className="stat-lbl">Unpaid or partial</div></div>
      </div>

      <div className="toolbar">
        <select className="input" value={filter} onChange={(e) => setFilter(e.target.value)}>
          {PAY_FILTERS.map((f) => <option key={f} value={f}>{f === "All" ? "All appointments" : f}</option>)}
        </select>
      </div>

      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Reference</th><th>Date</th><th>Client</th>
              <th className="r">Fee</th><th className="r">Paid</th><th className="r">Balance</th>
              <th>Progress</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((a) => {
              const fee = feeFor(a.id), paid = paidFor(a.id);
              const pct = fee > 0 ? Math.min((paid / fee) * 100, 100) : 0;
              const st = payStatus(fee, paid);
              return (
                <tr key={a.id} onClick={() => openDialog({ type: "detail", id: a.id })}>
                  <td><strong>{a.ref}</strong></td>
                  <td>{fmtDayLong(a.start_at)}</td>
                  <td>{a.client_name}</td>
                  <td className="r">{money(fee)}</td>
                  <td className="r">{money(paid)}</td>
                  <td className="r">{money(balFor(a.id))}</td>
                  <td><div className="progress"><div style={{ width: `${pct.toFixed(0)}%` }} /></div></td>
                  <td><Pill text={st} color={PAY_COLOR[st]} /></td>
                </tr>
              );
            }) : <tr><td className="empty-row" colSpan={8}>No appointments match.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
