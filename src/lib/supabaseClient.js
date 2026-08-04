import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Fails loudly at startup rather than deep inside a failed fetch during a
  // 30-second field entry — see .env.example for what to set.
  throw new Error(
    "Supabase config manquante : renseigne VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans .env.local"
  );
}

export const supabase = createClient(url, anonKey);
