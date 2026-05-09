import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Database } from "./types.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);
