import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useData } from "../context/DataContext.jsx";
import { useDialog } from "../context/DialogContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { addHoliday, removeHoliday } from "../lib/api.js";
import { dayKey, errMsg, fmtTime, todayKey } from "../lib/format.js";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const pad = (value) => String(value).padStart(2, "0");
const keyFor = (year, month, day) => `${year}-${pad(month)}-${pad(day)}`;

function shiftMonth(value, amount) {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
}

function formatDay(value, options) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", ...options })
    .format(new Date(`${value}T00:00:00Z`));
}

export default function DashboardCalendar() {
  const { isLeader } = useAuth();
  const { appts, holidays, teamName, reload } = useData();
  const { openDialog } = useDialog();
  const toast = useToast();
  const today = todayKey();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selectedDay, setSelectedDay] = useState(today);
  const [holidayDay, setHolidayDay] = useState(today);
  const [holidayReason, setHolidayReason] = useState("");
  const [busy, setBusy] = useState(false);

  const [year, monthNumber] = month.split("-").map(Number);
  const firstWeekday = (new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const cells = Array.from({ length: cellCount }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day > 0 && day <= daysInMonth ? keyFor(year, monthNumber, day) : null;
  });

  const apptsByDay = new Map();
  appts.forEach((appt) => {
    const key = dayKey(appt.start_at);
    apptsByDay.set(key, [...(apptsByDay.get(key) || []), appt]);
  });
  const holidaysByDay = new Map(holidays.map((holiday) => [holiday.day, holiday]));
  const selectedAppointments = [...(apptsByDay.get(selectedDay) || [])]
    .sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
  const upcomingHolidays = holidays.filter((holiday) => holiday.day >= today);

  function navigateMonth(amount) {
    const nextMonth = shiftMonth(month, amount);
    setMonth(nextMonth);
    setSelectedDay(`${nextMonth}-01`);
  }

  async function saveHoliday(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await addHoliday(holidayDay, holidayReason.trim());
      await reload();
      setHolidayReason("");
      toast.show("Company holiday added");
    } catch (error) {
      toast.show(errMsg(error), true);
    } finally {
      setBusy(false);
    }
  }

  async function deleteHoliday(holiday) {
    if (!window.confirm(`Remove ${holiday.reason || "this holiday"} on ${holiday.day}?`)) return;
    setBusy(true);
    try {
      await removeHoliday(holiday.day);
      await reload();
      toast.show("Company holiday removed");
    } catch (error) {
      toast.show(errMsg(error), true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="dashboard-panel calendar-panel" aria-labelledby="calendar-title">
      <div className="panel-header">
        <div>
          <h2 id="calendar-title">🗓️ Calendar &amp; office holidays</h2>
          <p className="panel-subtitle">Select a date to review its appointments and office closure.</p>
        </div>
      </div>

      {isLeader && (
        <div className="holiday-manager">
          <form className="holiday-form" onSubmit={saveHoliday}>
            <label>
              Holiday date
              <input
                className="input"
                type="date"
                min={today}
                value={holidayDay}
                onChange={(event) => setHolidayDay(event.target.value)}
                required
              />
            </label>
            <label>
              Holiday name or reason
              <input
                className="input"
                type="text"
                value={holidayReason}
                onChange={(event) => setHolidayReason(event.target.value)}
                maxLength={120}
                placeholder="e.g. Diwali"
                required
              />
            </label>
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? "Saving…" : "Add holiday"}
            </button>
          </form>
          <p className="holiday-note">
            Adding a holiday blocks new online bookings for that date. Existing appointments are not cancelled.
          </p>
          {upcomingHolidays.length > 0 && (
            <ul className="holiday-list" aria-label="Upcoming company holidays">
              {upcomingHolidays.map((holiday) => (
                <li key={holiday.day}>
                  <time dateTime={holiday.day}>{formatDay(holiday.day, { day: "numeric", month: "short", year: "numeric" })}</time>
                  <span>{holiday.reason || "Office closed"}</span>
                  <button
                    className="btn small danger"
                    type="button"
                    disabled={busy}
                    aria-label={`Remove holiday ${holiday.day}`}
                    onClick={() => deleteHoliday(holiday)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="calendar-layout">
        <div className="calendar-month">
          <div className="calendar-controls">
            <button className="btn small" type="button" aria-label="Previous month" onClick={() => navigateMonth(-1)}>‹</button>
            <h3>{formatDay(`${month}-01`, { month: "long", year: "numeric" })}</h3>
            <button className="btn small" type="button" aria-label="Next month" onClick={() => navigateMonth(1)}>›</button>
            <button
              className="btn small"
              type="button"
              onClick={() => {
                setMonth(today.slice(0, 7));
                setSelectedDay(today);
              }}
            >
              Today
            </button>
          </div>
          <div className="calendar-grid" role="group" aria-label={`${month} appointment calendar`}>
            {WEEKDAYS.map((weekday) => (
              <div className="calendar-weekday" aria-hidden="true" key={weekday}>{weekday}</div>
            ))}
            {cells.map((date, index) => {
              if (!date) return <div className="calendar-empty" aria-hidden="true" key={`empty-${index}`} />;
              const dayAppointments = apptsByDay.get(date) || [];
              const holiday = holidaysByDay.get(date);
              const selected = date === selectedDay;
              return (
                <div className="calendar-cell" key={date}>
                  <button
                    className={`calendar-day${selected ? " selected" : ""}${date === today ? " today" : ""}`}
                    type="button"
                    aria-label={`${date}${dayAppointments.length ? `, ${dayAppointments.length} appointment${dayAppointments.length === 1 ? "" : "s"}` : ""}${holiday ? `, holiday: ${holiday.reason || "office closed"}` : ""}`}
                    aria-pressed={selected}
                    onClick={() => setSelectedDay(date)}
                  >
                    <span>{Number(date.slice(-2))}</span>
                    <span className="calendar-markers" aria-hidden="true">
                      {dayAppointments.length > 0 && <span className="appointment-marker">{dayAppointments.length}</span>}
                      {holiday && <span className="holiday-marker">Holiday</span>}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
          <div className="calendar-legend">
            <span><i className="appointment-marker" aria-hidden="true" /> Appointment count</span>
            <span><i className="holiday-marker" aria-hidden="true" /> Office holiday</span>
          </div>
        </div>

        <div className="calendar-day-details">
          <h3>{formatDay(selectedDay, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h3>
          {holidaysByDay.has(selectedDay) && (
            <p className="calendar-closure">
              Office closed: {holidaysByDay.get(selectedDay).reason || "Holiday"}
            </p>
          )}
          {selectedAppointments.length ? (
            <div className="calendar-appointments">
              {selectedAppointments.map((appt) => (
                <button
                  className="calendar-appointment"
                  type="button"
                  key={appt.id}
                  aria-label={`Open ${appt.client_name} appointment details`}
                  onClick={() => openDialog({ type: "detail", id: appt.id })}
                >
                  <span className="calendar-appointment-time">{fmtTime(appt.start_at)}</span>
                  <span className="calendar-appointment-main">
                    <strong>{appt.client_name}</strong>
                    <span>{appt.service}</span>
                    <span>{appt.phone} · {teamName(appt.assigned_to)}</span>
                  </span>
                  <span className={`calendar-status status-${appt.status.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
                    {appt.status}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="muted">No appointments on this date.</p>
          )}
        </div>
      </div>
    </section>
  );
}
