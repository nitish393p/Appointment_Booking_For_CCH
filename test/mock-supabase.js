/* PREVIEW ONLY: a stand-in for the Supabase client with sample data.
 * The real app talks to Supabase; this lets you click through it without a database.
 * Nothing here is saved anywhere except this browser tab.
 */

  const TZ = "Asia/Kolkata";
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "id-" + Math.random().toString(36).slice(2));
  const dayStr = (off) => new Date(Date.now() + off * 864e5).toLocaleDateString("en-CA", { timeZone: TZ });
  const iso = (off, hh, mm) => new Date(`${dayStr(off)}T${hh}:${mm}:00+05:30`).toISOString();
  const nowIso = () => new Date().toISOString();

  const DIRECTOR = "u-dir", AD = "u-ad", FX = "u-fx";

  const DB = {
    profiles: [
      { id: DIRECTOR, full_name: "Capt. Sunil Srivastava", role: "director", active: true },
      { id: AD, full_name: "Meera Joshi", role: "assistant_director", active: true },
      { id: FX, full_name: "Arjun Rao", role: "forensics_expert", active: true },
    ],
    appointments: [
      { id: "a1", ref: "CCH-" + dayStr(0).replace(/-/g, "") + "-A1F3", client_name: "Rahul Mehta", phone: "9810000001",
        email: "rahul@example.com", service: "Online financial fraud / UPI / banking", urgency: "Critical",
        start_at: iso(0, "11", "00"), duration_min: 30, status: "Confirmed", notes: "UPI collect request fraud. Bank reference shared.",
        assigned_to: FX, source: "staff", created_at: nowIso() },
      { id: "a2", ref: "CCH-" + dayStr(0).replace(/-/g, "") + "-B7C2", client_name: "Anita Sharma", phone: "9810000002",
        email: "", service: "Digital forensics consultation", urgency: "Medium",
        start_at: iso(0, "15", "00"), duration_min: 45, status: "Requested", notes: "Review of phone data for a workplace dispute.",
        assigned_to: null, source: "web_booking", created_at: nowIso() },
      { id: "a3", ref: "CCH-" + dayStr(1).replace(/-/g, "") + "-C9D1", client_name: "Vikram Joshi", phone: "9810000003",
        email: "", service: "Social media or email hacking", urgency: "High",
        start_at: iso(1, "10", "30"), duration_min: 30, status: "Confirmed", notes: "Instagram account hacked. Recovery attempts made.",
        assigned_to: FX, source: "staff", created_at: nowIso() },
      { id: "a4", ref: "CCH-" + dayStr(2).replace(/-/g, "") + "-E2A8", client_name: "Priya Nair", phone: "9810000004",
        email: "", service: "Cyber harassment / extortion", urgency: "Critical",
        start_at: iso(2, "12", "00"), duration_min: 45, status: "Requested", notes: "Extortion via messaging app. Handle sensitively.",
        assigned_to: null, source: "web_booking", created_at: nowIso() },
      { id: "a5", ref: "CCH-" + dayStr(4).replace(/-/g, "") + "-F5B6", client_name: "Suresh Kulkarni", phone: "9810000005",
        email: "suresh@example.com", service: "Corporate cyber security audit", urgency: "Low",
        start_at: iso(4, "16", "00"), duration_min: 60, status: "Confirmed", notes: "Corporate audit scoping call.",
        assigned_to: AD, source: "staff", created_at: nowIso() },
      { id: "a6", ref: "CCH-" + dayStr(-2).replace(/-/g, "") + "-0C4E", client_name: "Meera Rao", phone: "9810000006",
        email: "", service: "Mobile or computer forensic analysis", urgency: "Medium",
        start_at: iso(-2, "14", "00"), duration_min: 30, status: "Completed", notes: "Laptop imaging completed. Report pending.",
        assigned_to: FX, source: "staff", created_at: nowIso() },
      { id: "a7", ref: "CCH-" + dayStr(-1).replace(/-/g, "") + "-9A7B", client_name: "Arjun Das", phone: "9810000007",
        email: "", service: "Cyber crime complaint / advisory", urgency: "Low",
        start_at: iso(-1, "10", "00"), duration_min: 30, status: "No-show", notes: "",
        assigned_to: null, source: "staff", created_at: nowIso() },
    ],
    appointment_finance: [
      { appointment_id: "a1", fee: 5000 }, { appointment_id: "a2", fee: 3000 },
      { appointment_id: "a3", fee: 2500 }, { appointment_id: "a4", fee: 4000 },
      { appointment_id: "a5", fee: 15000 }, { appointment_id: "a6", fee: 8000 },
      { appointment_id: "a7", fee: 500 },
    ],
    payments: [
      { id: uid(), appointment_id: "a1", amount: 2000, paid_on: dayStr(-1), method: "UPI", note: "Advance", recorded_by: DIRECTOR },
      { id: uid(), appointment_id: "a3", amount: 2500, paid_on: dayStr(0), method: "Bank transfer", note: "Paid in full", recorded_by: AD },
      { id: uid(), appointment_id: "a5", amount: 5000, paid_on: dayStr(-3), method: "Cheque", note: "Advance 1 of 3", recorded_by: DIRECTOR },
      { id: uid(), appointment_id: "a6", amount: 8000, paid_on: dayStr(-2), method: "Cash", note: "Paid on completion", recorded_by: AD },
    ],
    activity: [
      { id: uid(), appointment_id: "a2", actor: null, event: "Booking request received from the website", created_at: nowIso() },
      { id: uid(), appointment_id: "a1", actor: DIRECTOR, event: "Status: Requested -> Confirmed", created_at: nowIso() },
      { id: uid(), appointment_id: "a1", actor: DIRECTOR, event: "Payment ₹2,000.00 via UPI recorded", created_at: nowIso() },
      { id: uid(), appointment_id: "a6", actor: FX, event: "Status: Confirmed -> Completed", created_at: nowIso() },
      { id: uid(), appointment_id: "a4", actor: null, event: "Booking request received from the website", created_at: nowIso() },
    ],
    blocked_dates: [],
  };

  const matches = (r, filters) => filters.every(([c, v]) => String(r[c]) === String(v));
  const activeStatus = (s) => ["Requested", "Confirmed", "Rescheduled"].includes(s);

  function hasConflict(start, duration, exclude) {
    const s = new Date(start), e = new Date(s.getTime() + duration * 60000);
    return DB.appointments.some((a) => {
      if (a.id === exclude || !activeStatus(a.status)) return false;
      const as = new Date(a.start_at), ae = new Date(as.getTime() + a.duration_min * 60000);
      return as < e && s < ae;
    });
  }

  function slotsFor(day) {
    if (DB.blocked_dates.some((holiday) => holiday.day === day)) return [];
    if (new Date(`${day}T12:00:00+05:30`).getDay() === 1) return [];
    const times = [];
    for (let h = 10; h <= 17; h++) {
      for (const m of ["00", "30"]) times.push(`${String(h).padStart(2, "0")}:${m}`);
    }

    return times
      .filter((time) => time !== "10:00" && time !== "10:30"
        && !(time >= "13:00" && time <= "15:00"))
      .map((slot_time) => {
        const start = new Date(`${day}T${slot_time}:00+05:30`);
        const end = new Date(start.getTime() + 30 * 60000);
        const available = start > new Date() && !DB.appointments.some((a) => {
          if (!activeStatus(a.status)) return false;
          const existingStart = new Date(a.start_at);
          const existingEnd = new Date(existingStart.getTime() + a.duration_min * 60000);
          return existingStart < end && start < existingEnd;
        });
        return { slot_time, available };
      });
  }

  function book(args) {
    if (args.p_website) return { data: null, error: { message: "Request could not be accepted." } };
    if (!args.p_consent) return { data: null, error: { message: "Please agree to the privacy notice before booking." } };
    const phone = (args.p_phone || "").replace(/[^0-9+]/g, "");
    if (!/^\+?[0-9]{7,15}$/.test(phone)) return { data: null, error: { message: "Please enter a valid mobile number." } };
    if (args.p_day < dayStr(0)) return { data: null, error: { message: "Please choose today or a later date." } };
    if (args.p_day > dayStr(30)) return { data: null, error: { message: "Please choose a date within the next 30 days." } };
    if (DB.blocked_dates.some((holiday) => holiday.day === args.p_day)) {
      return { data: null, error: { message: "The office is closed on this date. Please choose another day." } };
    }
    if (new Date(`${args.p_day}T12:00:00+05:30`).getDay() === 1) {
      return { data: null, error: { message: "The office is closed on Mondays. Please choose another day." } };
    }
    const free = slotsFor(args.p_day).find((s) => s.slot_time === args.p_time && s.available);
    if (!free) return { data: null, error: { message: "That time is no longer available. Please choose another slot." } };
    if (DB.appointments.some((a) => a.phone === phone && activeStatus(a.status)
      && new Date(a.start_at).toLocaleDateString("en-CA", { timeZone: TZ }) === args.p_day)) {
      return { data: null, error: { message: "You already have a request for this day. Please call the office to change it." } };
    }
    const ref = "CCH-" + args.p_day.replace(/-/g, "") + "-" + Math.random().toString(16).slice(2, 6).toUpperCase();
    DB.appointments.push({
      id: uid(), ref, client_name: args.p_name, phone, email: args.p_email || "",
      service: args.p_service, urgency: args.p_urgency || "Medium",
      start_at: new Date(`${args.p_day}T${args.p_time}:00+05:30`).toISOString(), duration_min: 30,
      status: "Requested", notes: args.p_notes || "", assigned_to: null, source: "web_booking", created_at: nowIso(),
    });
    DB.activity.unshift({ id: uid(), appointment_id: DB.appointments.at(-1).id, actor: null,
      event: "Booking request received from the website", created_at: nowIso() });
    return { data: ref, error: null };
  }

  function execute(name, st) {
    const rows = DB[name];
    if (st.op === "insert" || st.op === "upsert") {
      const payloads = Array.isArray(st.payload) ? st.payload : [st.payload];
      if (name === "appointments" && payloads.some((p) => !p.mode)) {
        return {
          data: null,
          error: {
            code: "23502",
            message: 'null value in column "mode" of relation "appointments" violates not-null constraint',
          },
        };
      }
      if (name === "blocked_dates" && payloads.some((p) => rows.some((r) => r.day === p.day))) {
        return { data: null, error: { message: "A holiday is already recorded for this date." } };
      }
      const out = payloads.map((p) => {
        const existing = st.op === "upsert" && st.on ? rows.find((r) => r[st.on] === p[st.on]) : null;
        if (existing) { Object.assign(existing, p); return existing; }
        const storedPayload = { ...p };
        delete storedPayload.mode;
        const row = Object.assign({ id: uid(), created_at: nowIso() }, storedPayload);
        rows.push(row);
        return row;
      });
      return { data: st.single ? out[0] : out, error: null };
    }
    let sel = rows.filter((r) => matches(r, st.filters));
    if (st.op === "update") { sel.forEach((r) => Object.assign(r, st.payload)); return { data: sel, error: null }; }
    if (st.op === "delete") {
      DB[name] = rows.filter((r) => !sel.includes(r));
      if (name === "appointments") {
        const gone = new Set(sel.map((r) => r.id));
        DB.payments = DB.payments.filter((p) => !gone.has(p.appointment_id));
        DB.appointment_finance = DB.appointment_finance.filter((f) => !gone.has(f.appointment_id));
        DB.activity = DB.activity.filter((l) => !gone.has(l.appointment_id));
      }
      return { data: sel, error: null };
    }
    if (st.order) {
      const { c, asc } = st.order;
      sel = [...sel].sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1));
    }
    if (st.limit) sel = sel.slice(0, st.limit);
    if (st.single) return sel[0] ? { data: { ...sel[0] }, error: null } : { data: null, error: { message: "No rows found" } };
    return { data: sel.map((r) => ({ ...r })), error: null };
  }

  function from(name) {
    const st = { op: "select", payload: null, filters: [], order: null, limit: null, single: false, on: null };
    const b = {
      select() { return b; },
      order(c, o) { st.order = { c, asc: !(o && o.ascending === false) }; return b; },
      limit(n) { st.limit = n; return b; },
      eq(c, v) { st.filters.push([c, v]); return b; },
      single() { st.single = true; return b; },
      insert(p) { st.op = "insert"; st.payload = p; return b; },
      update(p) { st.op = "update"; st.payload = p; return b; },
      upsert(p, o) { st.op = "upsert"; st.payload = p; st.on = o && o.onConflict; return b; },
      delete() { st.op = "delete"; return b; },
      then(res, rej) { return Promise.resolve().then(() => execute(name, st)).then(res, rej); },
    };
    return b;
  }

  const session = { user: { id: DIRECTOR, email: "director@example.com" } };
  const client = {
    from,
    functions: {
      invoke(name, { body }) {
        if (name !== "admin-create-user") {
          return Promise.resolve({ data: null, error: { message: "Unknown function" } });
        }
        if (body.email === "unavailable@example.com") {
          return Promise.resolve({
            data: null,
            error: { name: "FunctionsFetchError", message: "Failed to send a request to the Edge Function" },
          });
        }
        const account = {
          id: uid(),
          email: body.email,
          full_name: body.full_name,
          role: body.role,
          active: true,
        };
        DB.profiles.push(account);
        return Promise.resolve({ data: { user: account }, error: null });
      },
    },
    rpc(name, args) {
      return Promise.resolve().then(() => {
        if (name === "has_conflict") return { data: hasConflict(args.p_start, args.p_duration, args.p_exclude), error: null };
        if (name === "public_slots") return { data: slotsFor(args.p_day), error: null };
        if (name === "public_book") {
          if (!args.p_mode) {
            return {
              data: null,
              error: { code: "PGRST202", message: "The deployed RPC still requires p_mode." },
            };
          }
          if (!["In-person", "Video call", "Phone call", "Not specified"].includes(args.p_mode)) {
            return { data: null, error: { message: "Please choose a valid meeting mode." } };
          }
          return book(args);
        }
        return { data: null, error: { message: "Unknown function" } };
      });
    },
    auth: {
      getSession: async () => ({ data: { session } }),
      getUser: async () => ({ data: { user: session.user } }),
      signInWithPassword: async () => ({ data: {}, error: null }),
      signOut: async () => ({ error: null }),
      // Like the real library: report the current session once, then return a subscription.
      onAuthStateChange: (callback) => {
        Promise.resolve().then(() => callback("INITIAL_SESSION", session));
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
  };

  // (exported below)

export function createClient() { return client; }
