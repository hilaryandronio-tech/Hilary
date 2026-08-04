import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out
  const [profil, setProfil] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setProfil(session === null ? null : profil);
      return;
    }
    supabase
      .from("profils")
      .select("id, nom, role, lot_id, actif")
      .eq("id", session.user.id)
      .single()
      .then(({ data, error }) => {
        if (error) console.error("Impossible de charger le profil", error);
        setProfil(data ?? null);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const signOut = () => supabase.auth.signOut();

  return (
    <AuthContext.Provider value={{ session, profil, signOut, loading: session === undefined }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé sous AuthProvider");
  return ctx;
}
