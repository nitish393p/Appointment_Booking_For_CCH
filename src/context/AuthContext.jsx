import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase.js";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, user: null, profile: null, error: "" });

  useEffect(() => {
    if (!supabase) {
      setState({ loading: false, user: null, profile: null, error: "" });
      return undefined;
    }

    async function load(session) {
      if (!session) {
        setState({ loading: false, user: null, profile: null, error: "" });
        return;
      }
      const { data: profile, error } = await supabase
        .from("profiles").select("*").eq("id", session.user.id).single();
      if (error || !profile || !profile.active) {
        await supabase.auth.signOut();
        setState({
          loading: false, user: null, profile: null,
          error: "This account is not set up or has been disabled. Please contact the director.",
        });
        return;
      }
      setState({ loading: false, user: session.user, profile, error: "" });
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => { load(session); });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo(() => ({
    ...state,
    isLeader: ["director", "assistant_director"].includes(state.profile?.role),
    isDirector: state.profile?.role === "director",
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error };
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
  }), [state]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);