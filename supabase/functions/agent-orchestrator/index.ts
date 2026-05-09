import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { callAgent } from "../_shared/zynd.ts";
import { supabase } from "../_shared/supabase.ts";

const SYSTEM_PROMPT = `
You are the Orchestrator Agent for WebScout. 
Your goal is to parse the user's intent and coordinate other agents (Discovery, Matching, Action) to fulfill their request.
If they want to find opportunities, call Discovery then Matching.
If they want to apply, call Action.
`;

serve(async (req) => {
  try {
    const { userId, query, action } = await req.json();

    // Log action to Superplane (Audit logs)
    await supabase.from("agent_logs").insert({
      agent_name: "webscout.orchestrator",
      user_id: userId,
      action: "received_query",
      details: { query, action }
    });

    let result = {};

    if (action === "scout") {
      // 1. Call Discovery
      const discoveryResult = await callAgent("webscout.discovery", { query });
      
      // 2. Call Matching with the discovered opportunities and user profile
      const matchingResult = await callAgent("webscout.matching", { 
        userId, 
        opportunities: discoveryResult.opportunities 
      });

      result = matchingResult;
    } else if (action === "apply") {
      // Call Action Agent
      result = await callAgent("webscout.action", { userId, query });
    }

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
