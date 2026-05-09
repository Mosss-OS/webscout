import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { callAgent } from "../_shared/zynd.ts";
import { supabase } from "../_shared/supabase.ts";
import { logToSuperplane } from "../_shared/superplane.ts";
import { registerAgentOnZNS } from "../_shared/zynd.ts";

const SYSTEM_PROMPT = `
You are the Orchestrator Agent for WebScout. 
Your goal is to parse the user's intent and coordinate other agents (Discovery, Matching, Action) to fulfill their request.
If they want to find opportunities, call Discovery then Matching.
If they want to apply, call Action.
`;

// Register this agent on Zynd network when the function starts
(async () => {
  try {
    await registerAgentOnZNS({
      agent_name: "webscout.orchestrator",
      endpoint_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/agent-orchestrator`,
      description: "Orchestrates the WebScout multi-agent system, routing user requests to appropriate agents",
      metadata: {
        capabilities: ["intent-parsing", "agent-coordination", "workflow-management"],
        supported_ecosystems: ["EVM", "Starknet", "Polkadot", "Stellar"]
      }
    });
  } catch (regError) {
    console.warn("[Orchestrator Agent] Failed to register on Zynd network:", regError);
    // Continue anyway - registration is nice to have but not critical for operation
  }
})();

serve(async (req) => {
  try {
    const { userId, query, action } = await req.json();

    // Log action to Supabase and Superplane (Audit trails)
    await supabase.from("agent_logs").insert({
      agent_name: "webscout.orchestrator",
      user_id: userId,
      action: "received_query",
      details: { query, action }
    });
    
    await logToSuperplane("webscout.orchestrator", userId, "received_query", { query, action });

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
    console.error("[Orchestrator Agent] Error:", error);
    
    // Log error to Supabase and Superplane
    await supabase.from("agent_logs").insert({
      agent_name: "webscout.orchestrator",
      user_id: userId,
      action: "error",
      details: { error: error.message }
    });
    
    await logToSuperplane("webscout.orchestrator", userId, "error", { error: error.message });
    
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
