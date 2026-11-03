import { useData } from "../context/DataContext.jsx";
import { useDialog } from "../context/DialogContext.jsx";
import { fmtStamp } from "../lib/format.js";

export default function Activity() {
  const { activity, byId, teamName } = useData();
  const { openDialog } = useDialog();

  return (
    <>
      <h1 className="page-title">Activity</h1>
      <div className="table-card">
        <table className="table">
          <thead>
            <tr><th>When</th><th>Reference</th><th>Client</th><th>By</th><th>Event</th></tr>
          </thead>
          <tbody>
            {activity.length ? activity.map((l) => {
              const a = byId(l.appointment_id);
              return (
                <tr key={l.id} onClick={a ? () => openDialog({ type: "detail", id: a.id }) : undefined}>
                  <td>{fmtStamp(l.created_at)}</td>
                  <td>{a ? a.ref : "–"}</td>
                  <td>{a ? a.client_name : "–"}</td>
                  <td>{teamName(l.actor)}</td>
                  <td>{l.event}</td>
                </tr>
              );
            }) : <tr><td className="empty-row" colSpan={5}>No activity yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
