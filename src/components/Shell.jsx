import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useData } from "../context/DataContext.jsx";
import { useDialog } from "../context/DialogContext.jsx";
import Dashboard from "../pages/Dashboard.jsx";
import Appointments from "../pages/Appointments.jsx";
import Payments from "../pages/Payments.jsx";
import Team from "../pages/Team.jsx";
import Activity from "../pages/Activity.jsx";
import { ROLE_LABEL, TZ } from "../lib/constants.js";
import { demoMode } from "../lib/supabase.js";

const PAGES = [
  { key: "dashboard", label: "Dashboard", Component: Dashboard },
  { key: "appointments", label: "Appointments", Component: Appointments },
  { key: "payments", label: "Payments", Component: Payments, leaderOnly: true },
  { key: "team", label: "Team", Component: Team },
  { key: "activity", label: "Activity", Component: Activity },
];

function DateLine() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="dateline">
      {now.toLocaleString("en-IN", {
        timeZone: TZ, weekday: "long", day: "2-digit", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit", hour12: true,
      })}
    </div>
  );
}

export default function Shell() {
  const { profile, isLeader, signOut } = useAuth();
  const { loadError, reload } = useData();
  const { openDialog } = useDialog();
  const [page, setPage] = useState("dashboard");

  const visible = PAGES.filter((p) => !p.leaderOnly || isLeader);
  const current = visible.find((p) => p.key === page) || visible[0];
  const Page = current.Component;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <img src="/cch-logo.png" alt="Cyber Crime Helpline LLP" className="brand-logo" />
          <div>
            <div className="brand-name">CyberCase</div>
            <div className="brand-sub">Appointments desk</div>
          </div>
        </div>
        <nav className="nav">
          {visible.map((p) => (
            <button key={p.key} className={"nav-item" + (current.key === p.key ? " active" : "")}
                    onClick={() => setPage(p.key)}>
              {p.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="user-name">{profile.full_name}</div>
          <div className="user-role">{ROLE_LABEL[profile.role]}</div>
          <button className="btn ghost small" onClick={signOut}>Sign out</button>
        </div>
      </aside>

      <main className="main">
        {demoMode && (
          <div className="alert-banner alert-info" role="status">
            <div>
              <strong>Demo mode</strong>
              <p>Sample data only. Changes are temporary and are not saved to Supabase.</p>
            </div>
          </div>
        )}
        <header className="topbar">
          <DateLine />
          <button className="btn primary" onClick={() => openDialog({ type: "new" })}>
            + Register client
          </button>
        </header>
        {loadError && (
          <div className="alert-banner alert-info" role="alert">
            <div>
              <strong>Shared data could not be refreshed.</strong>
              <p>Some information may be out of date. Check your connection and try again.</p>
            </div>
            <button className="btn small" onClick={reload}>Retry</button>
          </div>
        )}
        <Page />
      </main>
    </div>
  );
}
