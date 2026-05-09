import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { supabase } from "../_shared/supabase.ts";
import { logToSuperplane } from "../_shared/superplane.ts";
import { registerAgentOnZNS } from "../_shared/zynd.ts";
import { saveDraftToIPFS } from "../_shared/web3.ts";
import { rateLimitMiddleware } from "../_shared/rate-limiter.ts";

const SYSTEM_PROMPT = `
You are the Action Agent for WebScout.
Your job is to take a validated opportunity and a user's profile to generate personalized application drafts, outreach messages, or specific next-step recommendations.
`;

// Register this agent on Zynd network when the function starts
(async () => {
  try {
    await registerAgentOnZNS({
      agent_name: "webscout.action",
      endpoint_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/action-agent`,
      description: "Generates personalized application drafts and outreach messages for Web3 opportunities",
      metadata: {
        capabilities: ["application-writing", "outreach-messaging", "proposal-generation"],
        supported_ecosystems: ["EVM", "Starknet", "Polkadot", "Stellar"]
      }
    });
  } catch (regError) {
    console.warn("[Action Agent] Failed to register on Zynd network:", regError);
    // Continue anyway - registration is nice to have but not critical for operation
  }
})();

serve(rateLimitMiddleware(async (req) => {
  try {
    const { userId, opportunityId } = await req.json();

    const { data: user } = await supabase.from("users").select("*").eq("id", userId).single();
    const { data: opportunity } = await supabase.from("opportunities").select("*").eq("id", opportunityId).single();

    // Log action to Supabase and Superplane
    await supabase.from("agent_logs").insert({
      agent_name: "webscout.action",
      user_id: userId,
      action: "generate_draft",
      details: { opportunity_id: opportunityId }
    });
    
    await logToSuperplane("webscout.action", userId, "generate_draft", { opportunity_id: opportunityId });

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    let generatedDraft = "";

    if (OPENAI_API_KEY) {
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: `Create a personalized application draft for this opportunity: ${opportunity?.title} - ${opportunity?.description}. The user is from ${user?.location_preference || "Africa"} with skills in ${(user?.skills || []).join(", ")}.` }
            ]
          })
        });
        
        if (!response.ok) {
          throw new Error(`OpenAI API failed: ${response.statusText}`);
        }
        
        const aiData = await response.json();
        generatedDraft = aiData.choices?.[0]?.message?.content || "Failed to generate draft.";
      } catch (aiError) {
        console.error("[Action Agent] OpenAI API error:", aiError);
        // Fallback to template-based generation if AI fails
        generatedDraft = `Hello,\n\nI am a Web3 builder from ${user?.location_preference || "Africa"} with skills in ${(user?.skills || []).join(", ")}. I am very interested in the ${opportunity?.title} opportunity.\n\nHere is my proposal...`;
      }
    } else {
      // Fallback if no API key is provided
      generatedDraft = `Hello,\n\nI am a Web3 builder from ${user?.location_preference || "Africa"} with skills in ${(user?.skills || []).join(", ")}. I am very interested in the ${opportunity?.title} opportunity.\n\nHere is my proposal...`;
    }

    // Save the draft to database
    await supabase.from("saved_opportunities").upsert({
      user_id: userId,
      opportunity_id: opportunityId,
      status: "drafted",
      draft_content: generatedDraft
    }, { onConflict: "user_id, opportunity_id" });

    // Save draft to IPFS if user has a wallet address
    let ipfsCid: string | null = null;
    if (user?.wallet_address) {
      try {
        ipfsCid = await saveDraftToIPFS(generatedDraft);
        if (ipfsCid) {
          await supabase.from("agent_logs").insert({
            agent_name: "webscout.action",
            user_id: userId,
            action: "draft_saved_to_ipfs",
            details: { opportunity_id: opportunityId, ipfs_cid: ipfsCid }
          });
        }
      } catch (ipfsError) {
        console.error("[Action Agent] Failed to save draft to IPFS:", ipfsError);
        // Don't fail the whole request if IPFS fails
      }
    }

    // Log successful completion
    await supabase.from("agent_logs").insert({
      agent_name: "webscout.action",
      user_id: userId,
      action: "draft_generated",
      details: { 
        opportunity_id: opportunityId,
        draft_length: generatedDraft.length,
        saved_to_ipfs: !!ipfsCid
      }
    });
    
    await logToSuperplane("webscout.action", userId, "draft_generated", { 
      opportunity_id: opportunityId,
      draft_length: generatedDraft.length,
      saved_to_ipfs: !!ipfsCid
    });

    return new Response(JSON.stringify({ 
      success: true, 
      draft: generatedDraft,
      ipfs_cid: ipfsCid
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Action Agent] Error:", error);
    
    // Log error
    await supabase.from("agent_logs").insert({
      agent_name: "webscout.action",
      user_id: userId,
      action: "error",
      details: { error: error.message }
    });
    
    await logToSuperplane("webscout.action", userId, "error", { error: error.message });
    
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}));
