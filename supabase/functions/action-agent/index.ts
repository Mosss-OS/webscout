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

    // In a real hackathon, we would call OpenAI/Groq here using OPENAI_API_KEY
    // to generate a highly personalized draft based on `user.skills` and `opportunity.description`.
    const generatedDraft = `Hello,\n\nI am a Web3 builder from ${user?.location_preference || "Africa"} with skills in ${(user?.skills || []).join(", ")}. I am very interested in the ${opportunity?.title} opportunity.\n\nHere is my proposal...`;

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
