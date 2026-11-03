import { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useData } from "../context/DataContext.jsx";
import { useDialog } from "../context/DialogContext.jsx";
import Pill from "../components/Pill.jsx";
import { fmtDayLong, fmtTime, money } from "../lib/format.js";
import { STATUSES, URGENCY, SERVICES, STATUS_COLOR } from "../lib/constants.js";
import { payStatus } from "../lib/format.js";

export default function Appointments() {
  const { isLeader } = useAuth();
  const { appts, feeFor, paidFor, balFor, teamName } = useData();
  const { openDialog } = useDialog();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [urgency, setUrgency] = useState("");
  const [service, setService] = useState("");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return appts
      .filter((a) => !needle || `${a.client_name} ${a.ref} ${a.phone} ${a.email} ${a.service}`.toLowerCase().includes(needle))
      .filter((a) => !status || a.status === status)
      .filter((a) => !urgency || a.urgency === urgency)
      .filter((a) => !service || a.service === service)
      .sort((x, y) => new Date(y.start_at) - new Date(x.start_at));
  }, [appts, q, status, urgency, service]);

  function exportCsv() {
    const head = ["Reference", "Date", "Time", "Client", "Phone", "Email", "Service", "Urgency",
      "Status", "Fee", "Paid", "Balance", "Payment status", "Notes"];
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [head.join(",")].concat(appts.map((a) => {
      const fee = feeFor(a.id), paid = paidFor(a.id);
      return [a.ref, fmtDayLong(a.start_at), fmtTime(a.start_at), a.client_name, a.phone, a.email,
        a.service, a.urgency, a.status, fee.toFixed(2), paid.toFixed(2), balFor(a.id).toFixed(2),
        payStatus(fee, paid), a.notes].map(esc).join(",");
    }));
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "appointments_export.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <>
      <h1 className="page-title">Appointments</h1>
      <div className="toolbar">
        <input className="input grow" placeholder="Search name, reference, phone, service…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className="input" value={urgency} onChange={(e) => setUrgency(e.target.value)}>
          <option value="">All urgency</option>
          {URGENCY.map((u) => <option key={u}>{u}</option>)}
        </select>
        <select className="input" value={service} onChange={(e) => setService(e.target.value)}>
          <option value="">All services</option>
          {SERVICES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <button className="btn" onClick={exportCsv}>Export CSV</button>
      </div>

      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Reference</th><th>Date &amp; time</th><th>Client</th><th>Service</th>
              <th>Urgency</th><th>Status</th><th>Assigned to</th>
              {isLeader && <th className="r">Fee</th>}
              {isLeader && <th className="r">Balance</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((a) => (
              <tr key={a.id} onClick={() => openDialog({ type: "detail", id: a.id })}>
                <td><strong>{a.ref}</strong>{a.source === "web_booking" && <span className="tag">Website</span>}</td>
                <td>{fmtDayLong(a.start_at)}<div className="sub">{fmtTime(a.start_at)} · {a.duration_min} min</div></td>
                <td>{a.client_name}<div className="sub">{a.phone}</div></td>
                <td>{a.service}</td>
                <td>{a.urgency}</td>
                <td><Pill text={a.status} color={STATUS_COLOR[a.status]} /></td>
                <td>{teamName(a.assigned_to)}</td>
                {isLeader && <td className="r">{money(feeFor(a.id))}</td>}
                {isLeader && <td className="r">{money(balFor(a.id))}</td>}
              </tr>
            )) : (
              <tr><td className="empty-row" colSpan={isLeader ? 9 : 7}>No appointments match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
