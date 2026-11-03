import { useAuth } from "../context/AuthContext.jsx";
import { useData } from "../context/DataContext.jsx";
import ApptCard from "../components/ApptCard.jsx";
import DashboardCalendar from "../components/DashboardCalendar.jsx";
import { isActive, dayKey, todayKey, fmtDayHead, money, greeting } from "../lib/format.js";

const byStart = (a, b) => new Date(a.start_at) - new Date(b.start_at);

export default function Dashboard() {
  const { profile, isLeader } = useAuth();
  const { appts, payments, balFor } = useData();

  const now = new Date();
  const today = todayKey();
  const weekEnd = new Date(now.getTime() + 7 * 864e5);
  const live = appts.filter((a) => a.status !== "Cancelled");
  const todays = live.filter((a) => dayKey(a.start_at) === today).sort(byStart);
  const upcoming = live
    .filter((a) => isActive(a) && new Date(a.start_at) >= now && new Date(a.start_at) <= weekEnd)
    .sort(byStart);
  const webNew = live.filter((a) => a.status === "Requested" && a.source === "web_booking");

  const groups = {};
  upcoming.forEach((a) => { (groups[dayKey(a.start_at)] ||= []).push(a); });

  const outstanding = live.reduce((s, a) => s + balFor(a.id), 0);
  const month = today.slice(0, 7);
  const collected = payments.filter((p) => p.paid_on.startsWith(month)).reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1 className="page-title">{greeting()}, {profile.full_name}!</h1>
          <p className="header-subtitle">Here’s your appointment overview</p>
        </div>
      </div>

      {webNew.length > 0 && (
        <div className="alert-banner alert-info">
          <span className="alert-icon">📢</span>
          <div>
            <strong>{webNew.length} new booking request{webNew.length > 1 ? "s" : ""}</strong>
            <p>{webNew.length > 1 ? "These are" : "This is"} waiting for your confirmation. Review them below.</p>
          </div>
        </div>
      )}

      <div className="stats-grid">
        <Stat bar="teal" value={todays.length} label="Today’s appointments" icon="📅" />
        <Stat bar="blue" value={upcoming.length} label="Next 7 days" icon="📆" />
        <Stat bar="amber" value={live.filter((a) => a.status === "Requested").length} label="Awaiting confirmation" icon="⏳" />
        <Stat bar="red" value={live.filter((a) => a.urgency === "Critical" && isActive(a)).length} label="Open critical cases" icon="🚨" />
        {isLeader && <Stat bar="violet" value={money(outstanding)} label="Balance due" icon="💰" />}
        {isLeader && <Stat bar="green" value={money(collected)} label="Collected this month" icon="✅" />}
      </div>

      <div className="dashboard-grid">
        <section className="dashboard-panel">
          <div className="panel-header">
            <div>
              <h2>📅 Today’s Agenda</h2>
              <p className="panel-subtitle">{todays.length} appointment{todays.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <div className="panel-content">
            {todays.length ? todays.map((a) => <ApptCard key={a.id} a={a} />)
              : <div className="empty-state">
                  <div className="empty-icon">✨</div>
                  <p>No appointments today</p>
                  <span>Great day to catch up on other tasks!</span>
                </div>}
          </div>
        </section>

        <section className="dashboard-panel">
          <div className="panel-header">
            <div>
              <h2>📆 Next 7 Days</h2>
              <p className="panel-subtitle">{upcoming.length} appointment{upcoming.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <div className="panel-content">
            {upcoming.length ? Object.keys(groups).sort().map((k) => (
              <div key={k}>
                <div className="day-header">{fmtDayHead(groups[k][0].start_at)}</div>
                {groups[k].map((a) => <ApptCard key={a.id} a={a} />)}
              </div>
            )) : <div className="empty-state">
                  <div className="empty-icon">🎉</div>
                  <p>Nothing scheduled</p>
                  <span>Your calendar is clear for the next week!</span>
                </div>}
          </div>
        </section>
      </div>

      <DashboardCalendar />
    </div>
  );
}

function Stat({ bar, value, label, icon }) {
  return (
    <div className="stat-card">
      <div className="stat-header">
        <span className="stat-icon">{icon}</span>
        <div className={`stat-bar-indicator ${bar}`}></div>
      </div>
      <div className="stat-body">
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}
