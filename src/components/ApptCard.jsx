import { useDialog } from "../context/DialogContext.jsx";
import { useData } from "../context/DataContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { fmtTime, money } from "../lib/format.js";
import { STATUS_COLOR } from "../lib/constants.js";
import Pill from "./Pill.jsx";

export default function ApptCard({ a }) {
  const { openDialog } = useDialog();
  const { balFor, teamName } = useData();
  const { isLeader } = useAuth();
  return (
    <div className="appt-card" onClick={() => openDialog({ type: "detail", id: a.id })} role="button" tabIndex={0}>
      <div className={`stripe u-${a.urgency}`} />
      <div className="body">
        <div className="top">
          <span className="time">{fmtTime(a.start_at)}</span>
          <span className="name">{a.client_name}</span>
          <Pill text={a.status} color={STATUS_COLOR[a.status]} />
        </div>
        <div className="sub">{a.service} · {a.duration_min} min</div>
        <div className="sub">
          {a.urgency} urgency{isLeader ? ` · Balance ${money(balFor(a.id))}` : ""} · {teamName(a.assigned_to)}
        </div>
      </div>
    </div>
  );
}
