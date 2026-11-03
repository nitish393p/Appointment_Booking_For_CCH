import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2.118.0/cors";

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function defaultKey(name: string, legacyName: string) {
  const raw = Deno.env.get(name);
  if (!raw) return Deno.env.get(legacyName) ?? null;

  try {
    const keys = JSON.parse(raw);
    return typeof keys.default === "string" ? keys.default : Deno.env.get(legacyName) ?? null;
  } catch {
    return Deno.env.get(legacyName) ?? null;
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." });
  }

  const authorization = request.headers.get("Authorization");
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) {
    return jsonResponse(401, { error: "Sign in as the director to create staff accounts." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = defaultKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
  const secretKey = defaultKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !secretKey) {
    return jsonResponse(500, { error: "Staff account service is not configured in Supabase." });
  }

  const authClient = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return jsonResponse(401, { error: "Your session is invalid. Sign in again." });
  }

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: director, error: profileError } = await admin
    .from("profiles")
    .select("role, active")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError) {
    return jsonResponse(500, { error: "Could not verify director access. Check the Supabase database setup." });
  }
  if (!director?.active || director.role !== "director") {
    return jsonResponse(403, { error: "Only an active director can create staff accounts." });
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return jsonResponse(400, { error: "Enter valid account details." });
  }

  if (!input || typeof input !== "object") {
    return jsonResponse(400, { error: "Enter valid account details." });
  }

  const { full_name, email, password, role } = input as Record<string, unknown>;
  if (typeof full_name !== "string" || full_name.trim().length < 2 || full_name.trim().length > 120) {
    return jsonResponse(400, { error: "Enter a name between 2 and 120 characters." });
  }
  if (typeof email !== "string" || email.length > 254
    || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
    return jsonResponse(400, { error: "Enter a valid staff email address." });
  }
  if (typeof password !== "string" || password.length < 6 || password.length > 128) {
    return jsonResponse(400, { error: "Use a password between 6 and 128 characters." });
  }
  if (role !== "assistant_director" && role !== "forensics_expert") {
    return jsonResponse(400, { error: "Choose Assistant Director or Forensics Expert access." });
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { full_name: full_name.trim() },
  });

  if (createError || !created.user) {
    const message = createError?.message || "Supabase did not return the new user.";
    const duplicate = /already|registered|exists/i.test(message);
    return jsonResponse(duplicate ? 409 : 400, {
      error: duplicate ? "An account already exists for that email address." : message,
    });
  }

  const { data: profile, error: updateError } = await admin
    .from("profiles")
    .update({ full_name: full_name.trim(), role, active: true })
    .eq("id", created.user.id)
    .select("id")
    .maybeSingle();

  if (updateError || !profile) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(created.user.id);
    if (deleteError) {
      return jsonResponse(500, {
        error: "The account was created but could not be activated. Remove the incomplete user in Supabase Auth and check the profile trigger.",
      });
    }
    return jsonResponse(500, {
      error: "The account could not be activated. Apply supabase/schema.sql and check the profile trigger.",
    });
  }

  return jsonResponse(201, {
    user: {
      id: created.user.id,
      email: created.user.email,
      full_name: full_name.trim(),
      role,
    },
  });
});
