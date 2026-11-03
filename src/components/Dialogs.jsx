import { useEffect, useState } from "react";
import Modal from "./Modal.jsx";
import Field from "./Field.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useData } from "../context/DataContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import {
  hasConflict, insertAppointment, updateAppointment, deleteAppointment, publicSlots,
  upsertFee, insertPayment, logEvent,
} from "../lib/api.js";
import {
  istToIso, isoToIst, makeRef, money, errMsg, fmtStamp, fmtDayLong, fmtTime, isActive, todayKey,
} from "../lib/format.js";
import { SERVICES, PAY_METHODS, ROLE_LABEL, STATUS_COLOR } from "../lib/constants.js";
import Pill from "./Pill.jsx";

// Shows the right dialog for { type, id }. Dialogs reach each other through openDialog.
export default function Dialogs({ dialog, onClose, openDialog }) {
  const props = { id: dialog.id, onClose, openDialog };
  let content = null;
  switch (dialog.type) {
    case "detail": content = <DetailDialog {...props} />; break;
    case "new": content = <ApptForm onClose={onClose} />; break;
    case "edit": content = <ApptForm existingId={dialog.id} onClose={onClose} />; break;
    case "reschedule": content = <RescheduleDialog {...props} />; break;
    case "cancel": content = <CancelDialog {...props} />; break;
    case "assign": content = <AssignDialog {...props} />; break;
    case "note": content = <NoteDialog {...props} />; break;
    case "fee": content = <FeeDialog {...props} />; break;
    case "pay": content = <PaymentDialog {...props} />; break;
    default: content = null;
  }
  return <Modal
    onClose={onClose}
    variant={["new", "edit"].includes(dialog.type) ? "client-register-modal" : ""}
  >
    {content}
  </Modal>;
}

/* ------------------------------------------------------------------ detail */
function DetailDialog({ id, onClose, openDialog }) {
  const { isLeader, isDirector, user } = useAuth();
  const { byId, payments, activity, feeFor, paidFor, balFor, teamName, reload } = useData();
  const toast = useToast();
  const a = byId(id);
  const [busy, setBusy] = useState(false);

  if (!a) {
    return <><h2>Not available</h2><p className="muted">This appointment is not visible to your account.</p></>;
  }

  const active = isActive(a);
  const pays = payments.filter((p) => p.appointment_id === id)
    .sort((x, y) => (x.paid_on < y.paid_on ? 1 : -1));
  const logs = activity.filter((l) => l.appointment_id === id).slice(0, 12);

  async function setStatus(status) {
    setBusy(true);
    try {
      await updateAppointment(id, { status });
      await logEvent(id, `Status: ${a.status} -> ${status}`, user.id);
      toast.show(`Marked ${status}`);
      await reload();
      onClose();
    } catch (e) {
      toast.show(errMsg(e), true);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Permanently delete ${a.client_name} (${a.ref}) and its payment records?`)) return;
    setBusy(true);
    try {
      await deleteAppointment(id);
      toast.show("Appointment deleted");
      await reload();
      onClose();
    } catch (e) {
      toast.show(errMsg(e), true);
      setBusy(false);
    }
  }

  return (
    <>
      <h2>{a.client_name}</h2>
      <div className="sub">{a.ref} · <Pill text={a.status} color={STATUS_COLOR[a.status]} /> · {a.urgency} urgency</div>

      <div className="detail-grid">
        <div><span>When (IST)</span>{fmtDayLong(a.start_at)}, {fmtTime(a.start_at)} · {a.duration_min} min</div>
        <div className="full"><span>Service</span>{a.service}</div>
        <div><span>Mobile</span>{a.phone}</div>
        <div><span>Email</span>{a.email || "–"}</div>
        <div><span>Assigned to</span>{teamName(a.assigned_to)}</div>
        {isLeader && (
          <div><span>Fee · Paid · Balance</span>{money(feeFor(id))} · {money(paidFor(id))} · {money(balFor(id))}</div>
        )}
        <div className="full"><span>Notes</span><div className="prewrap">{a.notes || "–"}</div></div>
      </div>

      {isLeader && (
        <>
          <h3>Payments</h3>
          {pays.length ? (
            <ul className="history">
              {pays.map((p) => (
                <li key={p.id}>{money(p.amount)} · {p.method} · {p.paid_on}{p.note && <span> · {p.note}</span>}</li>
              ))}
            </ul>
          ) : <p className="muted">No payments recorded.</p>}
        </>
      )}

      <h3>Activity</h3>
      {logs.length ? (
        <ul className="history">
          {logs.map((l) => (
            <li key={l.id}>{l.event} <span>· {fmtStamp(l.created_at)} · {teamName(l.actor)}</span></li>
          ))}
        </ul>
      ) : <p className="muted">No activity yet.</p>}

      <div className="action-row">
        {isLeader && <button className="btn small" onClick={() => openDialog({ type: "edit", id })}>Edit</button>}
        {isLeader && <button className="btn small" onClick={() => openDialog({ type: "reschedule", id })}>Reschedule</button>}
        {isLeader && <button className="btn small" onClick={() => openDialog({ type: "assign", id })}>Assign</button>}
        {isLeader && active && a.status !== "Confirmed" && (
          <button className="btn small" disabled={busy} onClick={() => setStatus("Confirmed")}>Confirm</button>
        )}
        {active && <button className="btn small" disabled={busy} onClick={() => setStatus("Completed")}>Complete</button>}
        {active && <button className="btn small" disabled={busy} onClick={() => setStatus("No-show")}>No-show</button>}
        <button className="btn small" onClick={() => openDialog({ type: "note", id })}>Add note</button>
        {isLeader && <button className="btn small" onClick={() => openDialog({ type: "fee", id })}>Set fee</button>}
        {isLeader && <button className="btn small primary" onClick={() => openDialog({ type: "pay", id })}>Record payment</button>}
        {isLeader && active && <button className="btn small danger" onClick={() => openDialog({ type: "cancel", id })}>Cancel</button>}
        {isDirector && <button className="btn small danger" disabled={busy} onClick={remove}>Delete</button>}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ create / edit */
function nextRegisterDate(holidays = []) {
  const today = todayKey();
  const [year, month, day] = today.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const currentTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
  const [hour, minute] = currentTime.split(":").map(Number);
  const pastLastSlot = hour * 60 + minute >= 17 * 60 + 30;
  const holidayDays = new Set(holidays.map((holiday) => holiday.day));

  if (date.getUTCDay() === 1 || pastLastSlot || holidayDays.has(today)) {
    date.setUTCDate(date.getUTCDate() + 1);
  }

  for (let offset = 0; offset < 31; offset += 1) {
    const key = date.toISOString().slice(0, 10);
    if (date.getUTCDay() !== 1 && !holidayDays.has(key)) return key;
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return today;
}

function ApptForm({ existingId, onClose }) {
  const { user, isLeader } = useAuth();
  const { byId, feeFor, paidFor, reload, holidays } = useData();
  const toast = useToast();
  const existing = existingId ? byId(existingId) : null;

  const [v, setV] = useState(() => {
    if (existing) {
      const existingServices = existing.service.split(", ").map((service) => service.trim()).filter(Boolean);
      const selectedServices = existingServices.filter((service) => SERVICES.includes(service));
      const otherServices = existingServices.filter((service) => !SERVICES.includes(service));
      const otherDescription = otherServices
        .map((service) => service.startsWith("Other: ") ? service.slice(7) : service)
        .join(", ");
      return {
        client_name: existing.client_name, phone: existing.phone, email: existing.email || "",
        services: otherServices.length && !selectedServices.includes("Other")
          ? [...selectedServices, "Other"]
          : selectedServices,
        otherServiceDesc: otherDescription,
        ...isoToIst(existing.start_at), duration_min: String(existing.duration_min),
        fee: feeFor(existing.id).toFixed(2), status: existing.status, notes: existing.notes || "",
      };
    }
    return {
      client_name: "", phone: "", email: "", services: [], otherServiceDesc: "",
      date: nextRegisterDate(holidays), time: "",
      duration_min: "30", fee: "0",
      status: "Requested", notes: "",
    };
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [slots, setSlots] = useState([]);
  const [slotMessage, setSlotMessage] = useState("Choose a date to see available times.");
  const [slotsLoading, setSlotsLoading] = useState(false);
  const set = (k) => (e) => {
    const value = e.target.value;
    setErr("");
    setV((prev) => ({ ...prev, [k]: value }));
  };
  const changeDate = (event) => {
    const date = event.target.value;
    setErr("");
    setV((prev) => ({ ...prev, date, time: "" }));
  };
  const toggleService = (service) => {
    setErr("");
    setV((prev) => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter((item) => item !== service)
        : [...prev.services, service],
    }));
  };

  useEffect(() => {
    let cancelled = false;
    setSlots([]);
    if (!v.date) {
      setSlotMessage("Choose a date to see available times.");
      return undefined;
    }

    setSlotsLoading(true);
    setSlotMessage("Loading available times…");
    publicSlots(v.date)
      .then((daySlots) => {
        if (cancelled) return;
        const available = Array.isArray(daySlots) ? [...daySlots] : [];
        if (existing) {
          const current = isoToIst(existing.start_at);
          if (current.date === v.date) {
            const existingSlot = available.find((slot) => slot.slot_time === current.time);
            if (existingSlot) {
              existingSlot.available = true;
              existingSlot.current = true;
            } else {
              available.push({ slot_time: current.time, available: true, current: true });
              available.sort((a, b) => a.slot_time.localeCompare(b.slot_time));
            }
          }
        }
        setSlots(available);
        if (!available.some((slot) => slot.available)) {
          setSlotMessage("No times are available on this date. Please choose another day.");
        } else {
          setSlotMessage("");
        }
      })
      .catch((error) => {
        if (!cancelled) setSlotMessage(`Could not load appointment times: ${errMsg(error)}`);
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });

    return () => { cancelled = true; };
  }, [v.date, existing?.id, existing?.start_at]);

  async function save(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const client_name = v.client_name.trim();
      const phone = v.phone.trim();
      if (!client_name || !phone) throw new Error("Client name and mobile number are required.");
      if (!/^\+?[0-9 -]{7,15}$/.test(phone)) throw new Error("Enter a valid mobile number.");
      if (v.services.length === 0) throw new Error("Please select at least one service.");

      const start_at = istToIso(v.date, v.time);
      if (!start_at) throw new Error("Enter a valid date and time.");
      if (!existing && new Date(start_at) < new Date()) throw new Error("That date and time is already in the past.");
      const selectedSlot = slots.find((slot) => slot.slot_time === v.time);
      if (!selectedSlot || !selectedSlot.available) {
        throw new Error("Please choose an available time slot.");
      }

      const duration_min = Number(v.duration_min);
      const fee = isLeader ? Number(v.fee || 0) : null;
      if (fee !== null && (Number.isNaN(fee) || fee < 0)) throw new Error("Fee must be zero or more.");
      if (existing && fee !== null && fee < paidFor(existing.id) - 0.005) {
        throw new Error(`Fee cannot be less than the ${money(paidFor(existing.id))} already paid.`);
      }

      const slotChanged = !existing
        || new Date(existing.start_at).getTime() !== new Date(start_at).getTime()
        || existing.duration_min !== duration_min;
      if (slotChanged && await hasConflict(start_at, duration_min, existing?.id)) {
        throw new Error("This slot clashes with another active appointment. Please choose another time.");
      }

      const row = {
        client_name, phone, email: v.email.trim(),
        service: v.services.map((service) =>
          service === "Other" && v.otherServiceDesc.trim()
            ? `Other: ${v.otherServiceDesc.trim()}`
            : service
        ).join(", "),
        start_at, duration_min, notes: v.notes.trim(),
      };

      if (existing) {
        await updateAppointment(existing.id, row);
        if (fee !== null) await upsertFee(existing.id, fee);
        await logEvent(existing.id, "Details edited", user.id);
        toast.show("Appointment saved");
      } else {
        row.ref = makeRef(start_at);
        row.urgency = "Medium";
        row.status = isLeader ? v.status : "Requested";
        row.assigned_to = user.id;
        row.created_by = user.id;
        const created = await insertAppointment(row);
        if (fee !== null) await upsertFee(created.id, fee);
        await logEvent(created.id, `Created (${row.status})`, user.id);
        toast.show("Appointment created");
      }
      await reload();
      onClose();
    } catch (ex) {
      setErr(errMsg(ex));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="client-register" onSubmit={save}>
      <div className="client-register-header">
        <div className="client-register-icon" aria-hidden="true">✦</div>
        <div>
          <span className="client-register-eyebrow">{existing ? "CLIENT RECORD" : "NEW CLIENT"}</span>
          <h2>{existing ? "Edit appointment" : "Register client"}</h2>
          <p>{existing ? existing.ref : "Add client details and schedule a staff appointment."}</p>
        </div>
      </div>

      <div className="client-register-content">
        {err && <div className="form-err show client-register-error" role="alert">{err}</div>}
        <section className="register-section">
          <div className="register-section-title">
            <span className="register-step">1</span>
            <div><h3>Client details</h3><p>How can we contact this client?</p></div>
          </div>
          <div className="form-grid">
            <Field label="Client name *">
              <input autoFocus={!existing} autoComplete="name" value={v.client_name} onChange={set("client_name")} required />
            </Field>
            <Field label="Mobile number *">
              <input type="tel" autoComplete="tel" value={v.phone} onChange={set("phone")} required />
            </Field>
            <Field label="Email address">
              <input type="email" autoComplete="email" value={v.email} onChange={set("email")} />
            </Field>
          </div>
        </section>

        <section className="register-section">
          <div className="register-section-title">
            <span className="register-step">2</span>
            <div><h3>Services needed</h3><p>Select one or more services for this client.</p></div>
          </div>
          <fieldset className="register-services">
            <legend className="sr-only">Select services *</legend>
            <div className="register-services-grid">
              {SERVICES.map((service) => (
                <label key={service} className={`register-service${v.services.includes(service) ? " selected" : ""}`}>
                  <input
                    type="checkbox"
                    checked={v.services.includes(service)}
                    onChange={() => toggleService(service)}
                  />
                  <span className="register-service-check" aria-hidden="true">{v.services.includes(service) ? "✓" : ""}</span>
                  <span>{service}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {v.services.includes("Other") && (
            <Field label="Please describe the other service">
              <textarea rows={2} maxLength={200} placeholder="What service does the client need?"
                value={v.otherServiceDesc} onChange={set("otherServiceDesc")} />
            </Field>
          )}
        </section>

        <section className="register-section">
          <div className="register-section-title">
            <span className="register-step">3</span>
            <div><h3>Appointment details</h3><p>Choose the appointment date and time.</p></div>
          </div>
          <div className="form-grid">
            <Field label="Date (IST) *">
              <input
                type="date"
                min={!existing ? todayKey() : undefined}
                max={!existing ? new Date(Date.now() + 30 * 864e5).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) : undefined}
                value={v.date}
                onChange={changeDate}
                required
              />
            </Field>
            <div className="register-time-field">
              <span className="register-time-label">Available time (IST) *</span>
              {slotsLoading ? (
                <p className="register-slot-message" role="status">{slotMessage}</p>
              ) : slots.some((slot) => slot.available) ? (
                <div className="register-slots" role="group" aria-label="Available appointment times">
                  {slots.map((slot) => (
                    <button
                      type="button"
                      key={slot.slot_time}
                      className={`register-slot${v.time === slot.slot_time ? " selected" : ""}`}
                      disabled={!slot.available}
                      aria-pressed={v.time === slot.slot_time}
                      onClick={() => setV((prev) => ({ ...prev, time: slot.slot_time }))}
                    >
                      {new Date(`${v.date}T${slot.slot_time}:00+05:30`).toLocaleTimeString("en-IN", {
                        timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true,
                      })}
                      {slot.current && <span className="register-current-time">Current</span>}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="register-slot-message" role="status">{slotMessage}</p>
              )}
            </div>
            <Field label="Duration">
              <select value={v.duration_min} onChange={set("duration_min")}>
                {["30", "45", "60", "90"].map((duration) => (
                  <option key={duration} value={duration}>{duration} minutes</option>
                ))}
              </select>
            </Field>
            {!existing && isLeader && (
              <Field label="Initial status">
                <select value={v.status} onChange={set("status")}>
                  <option>Requested</option><option>Confirmed</option>
                </select>
              </Field>
            )}
            {isLeader && (
              <Field label="Consultation fee (₹)">
                <input type="number" min="0" step="0.01" value={v.fee} onChange={set("fee")} />
              </Field>
            )}
            <Field label="Notes for the team" wide>
              <textarea rows={3} placeholder="Add any useful context for the appointment…" value={v.notes} onChange={set("notes")} />
            </Field>
          </div>
        </section>

        <div className="modal-actions client-register-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={busy || slotsLoading}>
            {busy ? "Saving…" : existing ? "Save changes" : "Register client"}
          </button>
        </div>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ small single-purpose dialogs */
function useFormState(initial) {
  const [v, setV] = useState(initial);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { const value = e.target.value; setV((prev) => ({ ...prev, [k]: value })); };
  return { v, setV, set, err, setErr, busy, setBusy };
}

function RescheduleDialog({ id, onClose }) {
  const { byId, reload } = useData();
  const { user } = useAuth();
  const toast = useToast();
  const a = byId(id);
  const cur = isoToIst(a.start_at);
  const f = useFormState({ date: cur.date, time: cur.time, duration_min: String(a.duration_min), reason: "" });

  async function save(e) {
    e.preventDefault();
    f.setErr("");
    f.setBusy(true);
    try {
      if (!f.v.reason.trim()) throw new Error("Please enter a reason for rescheduling.");
      const start_at = istToIso(f.v.date, f.v.time);
      if (!start_at) throw new Error("Enter a valid date and time.");
      if (new Date(start_at) < new Date()) throw new Error("That date and time is already in the past.");
      const dur = Number(f.v.duration_min);
      if (await hasConflict(start_at, dur, id)) {
        throw new Error("This slot clashes with another active appointment. Please choose another time.");
      }
      await updateAppointment(id, { start_at, duration_min: dur, status: "Rescheduled" });
      await logEvent(id, `Rescheduled from ${fmtStamp(a.start_at)} to ${fmtStamp(start_at)}. Reason: ${f.v.reason.trim()}`, user.id);
      toast.show("Appointment rescheduled");
      await reload();
      onClose();
    } catch (ex) {
      f.setErr(errMsg(ex));
    } finally {
      f.setBusy(false);
    }
  }

  return (
    <form onSubmit={save}>
      <h2>Reschedule</h2>
      <div className="sub">{a.client_name} · {a.ref}</div>
      <div className="form-grid">
        <Field label="New date (IST) *"><input type="date" value={f.v.date} onChange={f.set("date")} required /></Field>
        <Field label="New time (IST) *"><input type="time" value={f.v.time} onChange={f.set("time")} required /></Field>
        <Field label="Duration (minutes)">
          <select value={f.v.duration_min} onChange={f.set("duration_min")}>
            {["30", "45", "60", "90"].map((d) => <option key={d}>{d}</option>)}
          </select>
        </Field>
        <Field label="Reason for rescheduling *" wide>
          <textarea rows={3} value={f.v.reason} onChange={f.set("reason")} />
        </Field>
      </div>
      {f.err && <div className="form-err show">{f.err}</div>}
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn primary" disabled={f.busy}>Save</button>
      </div>
    </form>
  );
}

function CancelDialog({ id, onClose }) {
  const { byId, reload } = useData();
  const { user } = useAuth();
  const toast = useToast();
  const a = byId(id);
  const f = useFormState({ reason: "" });

  async function save(e) {
    e.preventDefault();
    f.setErr("");
    f.setBusy(true);
    try {
      if (!f.v.reason.trim()) throw new Error("Please enter a reason for cancelling.");
      await updateAppointment(id, { status: "Cancelled" });
      await logEvent(id, `Cancelled. Reason: ${f.v.reason.trim()}`, user.id);
      toast.show("Appointment cancelled");
      await reload();
      onClose();
    } catch (ex) {
      f.setErr(errMsg(ex));
    } finally {
      f.setBusy(false);
    }
  }

  return (
    <form onSubmit={save}>
      <h2>Cancel appointment</h2>
      <div className="sub">{a.client_name} · {a.ref}</div>
      <div className="form-grid">
        <Field label="Reason for cancelling *" wide>
          <textarea rows={3} value={f.v.reason} onChange={f.set("reason")} />
        </Field>
      </div>
      {f.err && <div className="form-err show">{f.err}</div>}
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onClose}>Back</button>
        <button type="submit" className="btn danger" disabled={f.busy}>Cancel appointment</button>
      </div>
    </form>
  );
}

function AssignDialog({ id, onClose }) {
  const { byId, team, reload } = useData();
  const { user } = useAuth();
  const toast = useToast();
  const a = byId(id);
  const f = useFormState({ assigned_to: a.assigned_to || "" });

  async function save(e) {
    e.preventDefault();
    f.setErr("");
    f.setBusy(true);
    try {
      await updateAppointment(id, { assigned_to: f.v.assigned_to || null });
      const who = team.find((t) => t.id === f.v.assigned_to)?.full_name || "nobody";
      await logEvent(id, `Assigned to ${who}`, user.id);
      toast.show("Assignment saved");
      await reload();
      onClose();
    } catch (ex) {
      f.setErr(errMsg(ex));
    } finally {
      f.setBusy(false);
    }
  }

  return (
    <form onSubmit={save}>
      <h2>Assign appointment</h2>
      <div className="sub">{a.ref}</div>
      <div className="form-grid">
        <Field label="Assign to" wide>
          <select value={f.v.assigned_to} onChange={f.set("assigned_to")}>
            <option value="">Unassigned</option>
            {team.filter((t) => t.active).map((t) => (
              <option key={t.id} value={t.id}>{t.full_name} ({ROLE_LABEL[t.role]})</option>
            ))}
          </select>
        </Field>
      </div>
      {f.err && <div className="form-err show">{f.err}</div>}
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn primary" disabled={f.busy}>Save</button>
      </div>
    </form>
  );
}

function NoteDialog({ id, onClose }) {
  const { byId, reload } = useData();
  const { user, profile } = useAuth();
  const toast = useToast();
  const a = byId(id);
  const f = useFormState({ note: "" });

  async function save(e) {
    e.preventDefault();
    f.setErr("");
    f.setBusy(true);
    try {
      const text = f.v.note.trim();
      if (!text) throw new Error("Write a note first.");
      const stamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
      const merged = (a.notes ? a.notes + "\n" : "") + `[${stamp} · ${profile.full_name}] ${text}`;
      await updateAppointment(id, { notes: merged });
      await logEvent(id, "Note added", user.id);
      toast.show("Note added");
      await reload();
      onClose();
    } catch (ex) {
      f.setErr(errMsg(ex));
    } finally {
      f.setBusy(false);
    }
  }

  return (
    <form onSubmit={save}>
      <h2>Add note</h2>
      <div className="sub">{a.client_name} · {a.ref}</div>
      <div className="form-grid">
        <Field label="Note" wide>
          <textarea rows={4} value={f.v.note} onChange={f.set("note")} />
        </Field>
      </div>
      {f.err && <div className="form-err show">{f.err}</div>}
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn primary" disabled={f.busy}>Save note</button>
      </div>
    </form>
  );
}

function FeeDialog({ id, onClose }) {
  const { byId, feeFor, paidFor, reload } = useData();
  const { user } = useAuth();
  const toast = useToast();
  const a = byId(id);
  const f = useFormState({ fee: feeFor(id).toFixed(2) });

  async function save(e) {
    e.preventDefault();
    f.setErr("");
    f.setBusy(true);
    try {
      const fee = Number(f.v.fee);
      if (Number.isNaN(fee) || fee < 0) throw new Error("Enter a valid fee.");
      if (fee < paidFor(id) - 0.005) throw new Error(`Fee cannot be less than the ${money(paidFor(id))} already paid.`);
      await upsertFee(id, fee);
      await logEvent(id, `Fee set to ${money(fee)}`, user.id);
      toast.show("Fee saved");
      await reload();
      onClose();
    } catch (ex) {
      f.setErr(errMsg(ex));
    } finally {
      f.setBusy(false);
    }
  }

  return (
    <form onSubmit={save}>
      <h2>Set fee</h2>
      <div className="sub">{a.client_name}</div>
      <div className="form-grid">
        <Field label="Fee (₹) *" wide>
          <input type="number" min="0" step="0.01" value={f.v.fee} onChange={f.set("fee")} required />
        </Field>
      </div>
      {f.err && <div className="form-err show">{f.err}</div>}
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn primary" disabled={f.busy}>Save</button>
      </div>
    </form>
  );
}

function PaymentDialog({ id, onClose }) {
  const { byId, feeFor, balFor, reload } = useData();
  const { user } = useAuth();
  const toast = useToast();
  const a = byId(id);
  const due = balFor(id);
  const f = useFormState({ amount: due.toFixed(2), paid_on: todayKey(), method: "UPI", note: "" });

  async function save(e) {
    e.preventDefault();
    f.setErr("");
    f.setBusy(true);
    try {
      if (feeFor(id) <= 0) throw new Error("Set the fee for this appointment before recording a payment.");
      const amount = Number(f.v.amount);
      if (!(amount > 0)) throw new Error("Amount must be greater than zero.");
      if (amount > due + 0.005) throw new Error(`Amount is more than the balance due (${money(due)}).`);
      await insertPayment({
        appointment_id: id, amount, paid_on: f.v.paid_on, method: f.v.method,
        note: f.v.note.trim(), recorded_by: user.id,
      });
      await logEvent(id, `Payment ${money(amount)} via ${f.v.method} recorded`, user.id);
      toast.show("Payment recorded");
      await reload();
      onClose();
    } catch (ex) {
      f.setErr(errMsg(ex));
    } finally {
      f.setBusy(false);
    }
  }

  return (
    <form onSubmit={save}>
      <h2>Record payment</h2>
      <div className="sub">{a.client_name} · balance due {money(due)}</div>
      <div className="form-grid">
        <Field label="Amount (₹) *"><input type="number" min="0.01" step="0.01" value={f.v.amount} onChange={f.set("amount")} required /></Field>
        <Field label="Date paid *"><input type="date" value={f.v.paid_on} onChange={f.set("paid_on")} required /></Field>
        <Field label="Method">
          <select value={f.v.method} onChange={f.set("method")}>
            {PAY_METHODS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="Receipt no. / note"><input value={f.v.note} onChange={f.set("note")} /></Field>
      </div>
      {f.err && <div className="form-err show">{f.err}</div>}
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn primary" disabled={f.busy}>Save payment</button>
      </div>
    </form>
  );
}
