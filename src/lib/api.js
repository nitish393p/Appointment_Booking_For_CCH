/* All database calls live here. Security is enforced by Row Level Security
 * in the database (supabase/schema.sql), not by this file.
 */
import { supabase } from "./supabase.js";

// Turns a Supabase { data, error } result into data, or throws the error.
const unwrap = ({ data, error }) => {
  if (error) throw error;
  return data;
};

export async function fetchAll() {
  const [appts, fees, payments, team, activity, holidays] = await Promise.all([
    supabase.from("appointments").select("*").order("start_at", { ascending: false }),
    supabase.from("appointment_finance").select("appointment_id, fee"),
    supabase.from("payments").select("*").order("paid_on", { ascending: false }),
    supabase.from("profiles").select("id, full_name, role, active").order("full_name"),
    supabase.from("activity").select("*").order("created_at", { ascending: false }).limit(300),
    supabase.from("blocked_dates").select("day, reason").order("day"),
  ]);
  return {
    appts: unwrap(appts),
    fees: unwrap(fees),
    payments: unwrap(payments),
    team: unwrap(team),
    activity: unwrap(activity),
    holidays: unwrap(holidays),
  };
}

export const hasConflict = async (startIso, duration, excludeId) =>
  unwrap(await supabase.rpc("has_conflict", {
    p_start: startIso, p_duration: duration, p_exclude: excludeId || null,
  })) === true;

export async function insertAppointment(row) {
  const result = await supabase.from("appointments").insert(row).select().single();
  const legacyModeRequired = result.error?.code === "23502"
    && /column ["']mode["']/i.test(result.error.message || "")
    && /not-null constraint/i.test(result.error.message || "");

  if (!legacyModeRequired) return unwrap(result);

  // Older projects may still require this column until booking.sql is applied.
  return unwrap(await supabase.from("appointments")
    .insert({ ...row, mode: "In-person" }).select().single());
}

export const updateAppointment = async (id, patch) =>
  unwrap(await supabase.from("appointments").update(patch).eq("id", id));

export const deleteAppointment = async (id) =>
  unwrap(await supabase.from("appointments").delete().eq("id", id));

export const upsertFee = async (appointmentId, fee) =>
  unwrap(await supabase.from("appointment_finance").upsert(
    { appointment_id: appointmentId, fee }, { onConflict: "appointment_id" }));

export const insertPayment = async (row) =>
  unwrap(await supabase.from("payments").insert(row));

export const updateProfile = async (id, patch) =>
  unwrap(await supabase.from("profiles").update(patch).eq("id", id));

export const addHoliday = async (day, reason) =>
  unwrap(await supabase.from("blocked_dates").insert({ day, reason }).select().single());

export const removeHoliday = async (day) =>
  unwrap(await supabase.from("blocked_dates").delete().eq("day", day));

export async function createStaffAccount(account) {
  const { data, error } = await supabase.functions.invoke("admin-create-user", { body: account });
  if (error) {
    let message = error.message;
    if (error.context instanceof Response) {
      const body = await error.context.clone().json().catch(() => null);
      if (typeof body?.error === "string") message = body.error;
      if (error.context.status === 404 || body?.code === "NOT_FOUND") {
        message = "Staff account function is not deployed to this Supabase project. Deploy admin-create-user and try again.";
      }
    } else if (error.name === "FunctionsFetchError") {
      message = "Could not reach the staff account function. Confirm it is deployed to this Supabase project and its CORS settings allow this site.";
    }
    throw new Error(message);
  }
  return data.user;
}

export async function logEvent(appointmentId, event, actorId) {
  const { error } = await supabase.from("activity").insert({
    appointment_id: appointmentId, actor: actorId, event,
  });
  if (error) console.warn("Activity log failed:", error.message);
}

// Public booking (no login): only these two functions are allowed for visitors.
export const publicSlots = async (day) =>
  unwrap(await supabase.rpc("public_slots", { p_day: day }));

export async function publicBook(args) {
  const result = await supabase.rpc("public_book", args);
  if (result.error?.code !== "PGRST202") return unwrap(result);

  // Older database deployments still require this legacy field; the form does not expose it.
  return unwrap(await supabase.rpc("public_book", { ...args, p_mode: "In-person" }));
}
