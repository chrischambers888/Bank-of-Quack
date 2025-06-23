/// <reference types="vite/client" />
// src/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

// Look for VITE_* first (local dev) –
// fall back to the plain names that the Vercel × Supabase integration injects.
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL;

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

