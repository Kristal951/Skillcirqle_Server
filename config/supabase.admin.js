import { createClient } from "@supabase/supabase-js";
import dotenv from 'dotenv'
dotenv.config()

function getEnvVariables() {
  const supabaseURL = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseURL || !supabaseServiceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return { supabaseURL, supabaseServiceKey };
}

const { supabaseURL, supabaseServiceKey } = getEnvVariables();

console.log("🟢 Supabase Admin Initialized");

export const supabaseAdmin = createClient(
  supabaseURL,
  supabaseServiceKey
);