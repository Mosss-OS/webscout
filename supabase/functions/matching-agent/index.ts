import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { supabase } from "../_shared/supabase.ts";
import { logToSuperplane } from "../_shared/superplane.ts";
import { registerAgentOnZNS } from "../_shared/zynd.ts";

const SYSTEM_PROMPT = `
You are the Matching & Valuation Agent for WebScout.
Your job is to score and filter opportunities based on a user's skills, location, and preferences.
Prioritize opportunities relevant to African builders.
`;

// Register this agent on Zynd network when the function starts
(async () => {
  try {
    await registerAgentOnZNS({
      agent_name: "webscout.matching",
      endpoint_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/matching-agent`,
      description: "Matches Web3 opportunities to user skills and preferences",
      metadata: {
        capabilities": ["skill-matching", "opportunity-scoring", "africa-focused"],
        supported_ecosystems: ["EVM", "Starknet", "Polkadot", "Stellar"]
      }
    });
  } catch (regError) {
    console.warn("[Matching Agent] Failed to register on Zynd network:", regError);
    // Continue anyway - registration is nice to have but not critical for operation
  }
})();

serve(async (req) => {
  try {
    const { userId, opportunities } = await req.json();

    const { data: user } = await supabase.from("users").select("*").eq("id", userId).single();

    // Log action to Supabase and Superplane
    await supabase.from("agent_logs").insert({
      agent_name: "webscout.matching",
      user_id: userId,
      action: "matching_opportunities",
      details: { count: opportunities?.length || 0 }
    });
    
    await logToSuperplane("webscout.matching", userId, "matching_opportunities", { 
      count: opportunities?.length || 0 
    });

    // Simple heuristic matching logic (could use LLM here via OpenAI)
    const userSkills = user?.skills || [];
    const matched = (opportunities || []).map((opp: any) => {
      let score = 50; // base score
      if (opp.ecosystem === "Starknet" && userSkills.includes("Cairo")) score += 30;
      if (opp.description?.includes("Africa")) score += 20;
      // Boost score for opportunities that explicitly mention Africa or African builders
      if (opp.title.toLowerCase().includes("africa") || opp.title.toLowerCase().includes("african")) score += 15;
      return { ...opp, match_score: score };
    }).sort((a: any, b: any) => b.match_score - a.match_score);

    // Log successful completion
    await supabase.from("agent_logs").insert({
      agent_name: "webscout.matching",
      user_id: userId,
      action: "matching_completed",
      details: { 
        opportunities_processed: opportunities?.length || 0,
        matches_found: matched.length
      }
    });
    
    await logToSuperplane("webscout.matching", userId, "matching_completed", { 
      opportunities_processed: opportunities?.length || 0,
      matches_found: matched.length
    });

    return new Response(JSON.stringify({ success: true, matched_opportunities: matched }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Matching Agent] Error:", error);
    
    // Log error
    await supabase.from("agent_logs").insert({
      agent_name: "webscout.matching",
      user_id: userId,
      action: "error",
      details: { error: error.message }
    });
    
    await logToSuperplane("webscout.matching", userId, "error", { error: error.message });
    
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
