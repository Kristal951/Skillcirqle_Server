import { createClient } from "@supabase/supabase-js";
import dotenv from 'dotenv'
dotenv.config()

function getEnvVariables() {
  const supabaseURL = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseURL || !supabaseAnonKey) {
    throw new Error("Missing supabase url or anon key");
  }

  return { supabaseURL, supabaseAnonKey };
}

const { supabaseURL, supabaseAnonKey } = getEnvVariables();

export const supabase = createClient(supabaseURL, supabaseAnonKey);
