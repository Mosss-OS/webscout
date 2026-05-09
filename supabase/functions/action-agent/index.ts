import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { supabase } from "../_shared/supabase.ts";

const SYSTEM_PROMPT = `
You are the Action Agent for WebScout.
Your job is to take a validated opportunity and a user's profile to generate personalized application drafts, outreach messages, or specific next-step recommendations.
`;

serve(async (req) => {
  try {
    const { userId, opportunityId } = await req.json();

    const { data: user } = await supabase.from("users").select("*").eq("id", userId).single();
    const { data: opportunity } = await supabase.from("opportunities").select("*").eq("id", opportunityId).single();

    // Log action
    await supabase.from("agent_logs").insert({
      agent_name: "webscout.action",
      user_id: userId,
      action: "generate_draft",
      details: { opportunity_id: opportunityId }
    });

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    let generatedDraft = "";

    if (OPENAI_API_KEY) {
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
      const aiData = await response.json();
      generatedDraft = aiData.choices?.[0]?.message?.content || "Failed to generate draft.";
    } else {
      // Fallback if no API key is provided
      generatedDraft = `Hello,\n\nI am a Web3 builder from ${user?.location_preference || "Africa"} with skills in ${(user?.skills || []).join(", ")}. I am very interested in the ${opportunity?.title} opportunity.\n\nHere is my proposal...`;
    }

    // Save the draft
    await supabase.from("saved_opportunities").upsert({
      user_id: userId,
      opportunity_id: opportunityId,
      status: "drafted",
      draft_content: generatedDraft
    }, { onConflict: "user_id, opportunity_id" });

    return new Response(JSON.stringify({ success: true, draft: generatedDraft }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
