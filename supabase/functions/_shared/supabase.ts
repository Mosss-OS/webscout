import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Database } from "./types.ts";

// Validate required environment variables
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl) {
  throw new Error("SUPABASE_URL is not set");
}
if (!supabaseKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);
