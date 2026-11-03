import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL || "";
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
export const demoMode = import.meta.env.DEV && import.meta.env.MODE === "demo";

// False until .env.local has real values, so the app can show a setup message.
export const configured = demoMode || Boolean(url && anonKey && !url.includes("YOUR-PROJECT"));

export const supabase = configured ? createClient(url, anonKey) : null;
