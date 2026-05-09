import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { supabase } from "../_shared/supabase.ts";

const SYSTEM_PROMPT = `
You are the Discovery Agent for WebScout.
Your job is to interface with data sources (e.g., Apify actors) to find the latest Web3 grants, bounties, and hackathons.
`;

serve(async (req) => {
  try {
    const { query } = await req.json();

    // Log action
    await supabase.from("agent_logs").insert({
      agent_name: "webscout.discovery",
      action: "scraping_started",
      details: { query }
    });

    // In a real scenario, this is where we call Apify API using APIFY_API_TOKEN.
    // For now, we simulate finding opportunities.
    const mockOpportunities = [
      {
        source: "Apify_Gitcoin",
        title: "Starknet Africa Grant",
        description: "Build onboarding tools for African developers.",
        url: "https://starknet.io/grant/123",
        ecosystem: "Starknet",
        payout: "$5000",
      },
      {
        source: "Apify_Bounties",
        title: "EVM Smart Contract Audit",
        description: "Audit our DeFi protocol.",
        url: "https://bounties.network/12",
        ecosystem: "EVM",
        payout: "$2000",
      }
    ];

    // Optionally save to database
    for (const opp of mockOpportunities) {
      await supabase.from("opportunities").upsert(opp, { onConflict: "url", ignoreDuplicates: true });
    }

    return new Response(JSON.stringify({ success: true, opportunities: mockOpportunities }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
