import { useEffect, useState } from "react";
import "../booking.css";
import { configured, demoMode } from "../lib/supabase.js";
import { publicSlots, publicBook } from "../lib/api.js";
import { SERVICES, TZ } from "../lib/constants.js";
import { errMsg } from "../lib/format.js";

// Calendar date (YYYY-MM-DD) in India time, for a Date object
const istDay = (d) => d.toLocaleDateString("en-CA", { timeZone: TZ });
const weekdayOf = (ymd) => new Date(`${ymd}T12:00:00+05:30`).getDay(); // 0 = Sunday

export default function Booking() {
  const today = istDay(new Date());
  const maxDay = istDay(new Date(Date.now() + 30 * 864e5));

  const [form, setForm] = useState({
    services: [], day: "", name: "", phone: "", email: "", notes: "", otherServiceDesc: "",
    consent: false, website: "",
  });
  const [slots, setSlots] = useState([]);
  const [slotMsg, setSlotMsg] = useState("Pick a date to see available times.");
  const [time, setTime] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const set = (k) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [k]: value }));
  };

  const toggleService = (service) => {
    setForm((prev) => {
      const services = prev.services.includes(service)
        ? prev.services.filter((s) => s !== service)
        : [...prev.services, service];
      return { ...prev, services };
    });
  };

  // Load free times whenever the chosen date changes
  useEffect(() => {
    let cancelled = false;
    setTime(null);
    setSlots([]);
    if (!configured) return undefined;
    if (!form.day) { setSlotMsg("Pick a date to see available times."); return undefined; }
    if (form.day < today || form.day > maxDay) { setSlotMsg("Please choose a date within the next 30 days."); return undefined; }
    if (weekdayOf(form.day) === 1) { setSlotMsg("The office is closed on Mondays. Please choose a Tuesday to Sunday."); return undefined; }

    setSlotMsg("Loading available times…");
    publicSlots(form.day)
      .then((data) => {
        if (cancelled) return;
        if (!data || data.length === 0) setSlotMsg("The office is closed on this date. Please choose another day.");
        else if (!data.some((s) => s.available)) setSlotMsg("No times are left on this date. Please choose another day.");
        else { setSlots(data); setSlotMsg(""); }
      })
      .catch(() => { if (!cancelled) setSlotMsg("Could not load times. Please refresh the page and try again."); });
    return () => { cancelled = true; };
  }, [form.day, today, maxDay, refreshKey]);

  function validate() {
    if (form.services.length === 0) return "Please select at least one service.";
    if (!form.day) return "Please choose a date.";
    if (!time) return "Please choose a time slot.";
    if (form.name.trim().length < 2) return "Please enter your full name.";
    if (!/^\+?[0-9 -]{7,15}$/.test(form.phone.trim())) return "Please enter a valid mobile number.";
    if (form.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) return "Please enter a valid email address, or leave it blank.";
    if (form.notes.length > 1000) return "Please keep the description under 1000 characters.";
    if (!form.consent) return "Please tick the consent box to continue.";
    return null;
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    const problem = validate();
    if (problem) { setError(problem); return; }
    setBusy(true);
    try {
      const services = form.services.map((service) =>
        service === "Other" && form.otherServiceDesc.trim()
          ? `Other: ${form.otherServiceDesc.trim()}`
          : service
      );
      const ref = await publicBook({
        p_name: form.name.trim(), p_phone: form.phone.trim(), p_email: form.email.trim(),
        p_service: services.join(", "), p_day: form.day,
        p_time: time, p_notes: form.notes.trim(), p_consent: form.consent, p_website: form.website,
        p_urgency: "Medium",
      });
      setReference(ref);
    } catch (ex) {
      const msg = errMsg(ex);
      if (ex?.code === "PGRST202") {
        setError("Online booking is temporarily unavailable. Please contact the office while the booking service is configured.");
        return;
      }
      const known = /please|already|closed|no longer|valid|agree|could not|choose|today/i.test(msg);
      setError(known ? msg : "We could not save your request. Please try again in a few minutes or call the office.");
      if (/no longer available/i.test(msg)) setRefreshKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return <div className="page-msg">The booking page is not configured yet. Please contact the office.</div>;
  }

  return (
    <>
      <header>
        <div className="wrap">
          <div className="header-logo-section">
            <img src="/cch-logo.png" alt="Cyber Crime Helpline LLP" className="header-logo" />
            <div>
              <h1>Cyber Crime Helpline LLP</h1>
              <p>Book an appointment with Capt. Sunil Srivastava · Cyber crime and digital forensics</p>
            </div>
          </div>
        </div>
      </header>

      <main>
        {demoMode && (
          <div className="err" role="status">
            Demo mode: bookings use temporary sample data and are not sent to the office.
          </div>
        )}
        {error && <div className="err">{error}</div>}

        {reference ? (
          <section className="card success">
            <div className="tick">✓</div>
            <h2>Request received</h2>
            <p>Please keep this reference number:</p>
            <div className="ref">{reference}</div>
            <p className="hint">Our team will confirm your appointment shortly. If your matter is urgent, call 1930 or 112 now.</p>
            <button className="btn" style={{ maxWidth: 260, marginTop: 8 }} onClick={() => window.location.reload()}>
              Book another appointment
            </button>
          </section>
        ) : (
          <form onSubmit={submit} noValidate>
            <section className="card">
              <h2>1. What do you need help with?</h2>
              <p className="hint">Select one or more services that match your needs. You can explain in detail below.</p>
              <div className="services-grid">
                {SERVICES.map((s) => (
                  <label key={s} className="service-checkbox">
                    <input
                      type="checkbox"
                      checked={form.services.includes(s)}
                      onChange={() => toggleService(s)}
                    />
                    <span>{s}</span>
                  </label>
                ))}
              </div>

              {form.services.includes("Other") && (
                <label className="full" style={{ marginTop: 16 }}>
                  Please briefly describe your other service need
                  <textarea maxLength={200} placeholder="What service are you looking for?"
                            value={form.otherServiceDesc} onChange={set("otherServiceDesc")} />
                  <span className="count">{form.otherServiceDesc.length} / 200</span>
                </label>
              )}
            </section>

            <section className="card">
              <h2>2. Choose a date and time</h2>
              <p className="hint">Office hours: Tuesday to Sunday, 10:30 am to 6:00 pm (India time). Appointments are unavailable from 10:00 to 11:00 am and 1:00 to 3:30 pm. Mondays are closed. Future slots today are available to book, and you can also book up to 30 days ahead.</p>
              <label>Date <span className="req">*</span>
                <input type="date" min={today} max={maxDay} value={form.day} onChange={set("day")} />
              </label>
              <div style={{ marginTop: 14 }}>
                {slots.length > 0 ? (
                  <div className="slots">
                    {slots.map((s) => (
                      <button type="button" key={s.slot_time} className={"slot" + (time === s.slot_time ? " sel" : "")}
                              disabled={!s.available} onClick={() => setTime(s.slot_time)}>
                        {new Date(`${form.day}T${s.slot_time}:00+05:30`)
                          .toLocaleTimeString("en-IN", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true })}
                      </button>
                    ))}
                  </div>
                ) : <div className="slot-msg">{slotMsg}</div>}
              </div>
            </section>

            <section className="card">
              <h2>3. Your details</h2>
              <p className="hint">Only the office team sees these details. We will contact you on the number you give.</p>
              <div className="grid">
                <label>Full name <span className="req">*</span>
                  <input value={form.name} onChange={set("name")} autoComplete="name" maxLength={120} />
                </label>
                <label>Mobile number <span className="req">*</span>
                  <input type="tel" inputMode="tel" autoComplete="tel" placeholder="e.g. 9810012345" maxLength={20}
                         value={form.phone} onChange={set("phone")} />
                </label>
                <label className="full">Email (optional)
                  <input type="email" autoComplete="email" maxLength={160} value={form.email} onChange={set("email")} />
                </label>
                <label className="full">Briefly describe the issue
                  <textarea maxLength={1000} placeholder="For example: what happened, when, and whether money was lost. Do not share passwords or OTPs."
                            value={form.notes} onChange={set("notes")} />
                  <span className="count">{form.notes.length} / 1000</span>
                </label>
              </div>
              {/* Hidden trap for bots. Real people never see or fill this field. */}
              <div className="trap" aria-hidden="true">
                <label>Website <input tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} /></label>
              </div>
            </section>

            <section className="card">
              <h2>4. Consent</h2>
              <p className="notice">
                <strong>Consultation fee: ₹2,000.</strong>
                Additional charges may apply depending on the services required. Our team will discuss any further
                charges with you before proceeding.
              </p>
              <label className="consent">
                <input type="checkbox" checked={form.consent} onChange={set("consent")} />
                <span>I agree that Cyber Crime Helpline LLP may use the details above to arrange and prepare for my
                  appointment, as explained in the privacy notice below. <span className="req">*</span></span>
              </label>
              <details>
                <summary>Privacy Notice & Confidentiality</summary>
                <div className="privacy-notice">
                  <p><strong>All Cases Details are kept Highly Confidential.</strong></p>

                  <p>We collect your name, mobile number, email (if given), and the description you write. We use them only to arrange your appointment and to contact you about it.</p>

                  <p><strong>Data Access & Protection:</strong> Access is limited to the director and the staff who handle your case. We keep this information only as long as needed under applicable law.</p>

                  <p><strong>Your Rights:</strong> You can ask us to correct or delete your information by contacting the office.</p>

                  <p><strong>Important:</strong> Do not send passwords, OTPs, or bank PINs through this form.</p>
                </div>
              </details>
            </section>

            <button type="submit" className="btn submit" disabled={busy}>
              {busy ? "Sending…" : "Request appointment"}
            </button>
            <p className="hint center">You will get a reference number. The office confirms the booking by phone or email.</p>
          </form>
        )}
      </main>

      <footer>Cyber Crime Helpline LLP · Your details are sent over an encrypted connection.</footer>
    </>
  );
}
