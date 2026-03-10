import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

function tryCreateClient() {
  try {
    if (supabaseUrl && supabaseKey) {
      return createClient(supabaseUrl, supabaseKey);
    }
  } catch {
    // Ignore — env vars may be missing or invalid
  }
  return null;
}

export const supabase = tryCreateClient();
