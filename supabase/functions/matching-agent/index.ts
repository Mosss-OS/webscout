import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { supabase } from "../_shared/supabase.ts";

const SYSTEM_PROMPT = `
You are the Matching & Valuation Agent for WebScout.
Your job is to score and filter opportunities based on a user's skills, location, and preferences.
Prioritize opportunities relevant to African builders.
`;

serve(async (req) => {
  try {
    const { userId, opportunities } = await req.json();

    const { data: user } = await supabase.from("users").select("*").eq("id", userId).single();

    // Log action
    await supabase.from("agent_logs").insert({
      agent_name: "webscout.matching",
      user_id: userId,
      action: "matching_opportunities",
      details: { count: opportunities?.length || 0 }
    });

    // Simple heuristic matching logic (could use LLM here via OpenAI)
    const userSkills = user?.skills || [];
    const matched = (opportunities || []).map((opp: any) => {
      let score = 50; // base score
      if (opp.ecosystem === "Starknet" && userSkills.includes("Cairo")) score += 30;
      if (opp.description?.includes("Africa")) score += 20;
      return { ...opp, match_score: score };
    }).sort((a: any, b: any) => b.match_score - a.match_score);

    return new Response(JSON.stringify({ success: true, matched_opportunities: matched }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
