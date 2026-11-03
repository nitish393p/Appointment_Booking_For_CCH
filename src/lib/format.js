import { TZ, ACTIVE } from "./constants.js";

export const money = (n) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const dayKey = (iso) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD
export const todayKey = () => dayKey(new Date());
export const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString("en-IN", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: true });
export const fmtDayLong = (iso) =>
  new Date(iso).toLocaleDateString("en-IN", { timeZone: TZ, weekday: "short", day: "2-digit", month: "short", year: "numeric" });
export const fmtDayHead = (iso) =>
  new Date(iso).toLocaleDateString("en-IN", { timeZone: TZ, weekday: "long", day: "2-digit", month: "long" });
export const fmtStamp = (iso) =>
  new Date(iso).toLocaleString("en-IN", {
    timeZone: TZ, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true,
  });

export const isActive = (a) => ACTIVE.includes(a.status);

export const payStatus = (fee, paid) =>
  fee <= 0 ? "No fee" : paid <= 0 ? "Unpaid" : paid + 0.005 < fee ? "Partial" : "Paid";

// Clinic times are India Standard Time, which has no daylight saving, so the offset is fixed.
export function istToIso(date, time) {
  if (!date || !time) return null;
  const d = new Date(`${date}T${time}:00+05:30`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function isoToIst(iso) {
  const [date, time] = new Date(iso).toLocaleString("sv-SE", { timeZone: TZ }).split(" ");
  return { date, time: time.slice(0, 5) };
}

export function makeRef(iso) {
  const rnd = Array.from(crypto.getRandomValues(new Uint8Array(2)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `CCH-${dayKey(iso).replace(/-/g, "")}-${rnd}`;
}

export function greeting(date = new Date()) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(date));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export const errMsg = (e) => e?.message || String(e);
