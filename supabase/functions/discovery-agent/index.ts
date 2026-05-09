import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { supabase } from "../_shared/supabase.ts";
import { runApifyActor } from "../_shared/apify.ts";
import { logToSuperplane } from "../_shared/superplane.ts";
import { registerAgentOnZNS } from "../_shared/zynd.ts";

const SYSTEM_PROMPT = `
You are the Discovery Agent for WebScout.
Your job is to interface with data sources (e.g., Apify actors) to find the latest Web3 grants, bounties, and hackathons.
`;

// Register this agent on Zynd network when the function starts
// In a production environment, you might want to do this less frequently
// to avoid excessive registration attempts
(async () => {
  try {
    await registerAgentOnZNS({
      agent_name: "webscout.discovery",
      endpoint_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/discovery-agent`,
      description: "Discovers Web3 opportunities using Apify actors",
      metadata: {
        capabilities: ["web-scraping", "opportunity-discovery"],
        supported_ecosystems: ["EVM", "Starknet", "Polkadot"]
      }
    });
  } catch (regError) {
    console.warn("[Discovery Agent] Failed to register on Zynd network:", regError);
    // Continue anyway - registration is nice to have but not critical for operation
  }
})();

serve(async (req) => {
  try {
    const { query } = await req.json();

    // Log action to Supabase and Superplane
    await supabase.from("agent_logs").insert({
      agent_name: "webscout.discovery",
      action: "scraping_started",
      details: { query }
    });
    
    await logToSuperplane("webscout.discovery", null, "scraping_started", { query });

    // Define Apify actors to run for different sources
    // These are example actor IDs - in practice, you would use real ones
    const apifyActors = [
      { 
        id: "webscout/gitcoin-scraper", 
        name: "Gitcoin Grants", 
        ecosystem: "EVM" 
      },
      { 
        id: "webscout/grants-scraper", 
        name: "Web3 Grants", 
        ecosystem: "Starknet" 
      },
      { 
        id: "webscout/bounty-board-scraper", 
        name: "Bounty Boards", 
        ecosystem: "Polkadot" 
      }
    ];

    // Run all Apify actors and collect results
    let allOpportunities: any[] = [];
    
    for (const actor of apifyActors) {
      try {
        console.log(`[Discovery Agent] Running Apify actor: ${actor.name}`);
        const results = await runApifyActor(actor.id, { 
          query: query || "web3 grant bounty hackathon Africa",
          limit: 10
        });
        
        // Process and normalize the results
        const processedResults = results.map((item: any) => {
          // Skip items without essential data
          if (!item.url && !item.apply_url) return null;
          
          return {
            source: `Apify_${actor.name.replace(/\s+/g, "_")}`,
            title: item.title || item.job_title || "Untitled Opportunity",
            description: item.description || item.summary || "",
            url: item.url || item.apply_url || "",
            ecosystem: item.ecosystem || actor.ecosystem || "Unknown",
            payout: item.payout || item.compensation || "TBD",
            requirements: Array.isArray(item.requirements) ? item.requirements : 
                         (item.skills ? item.skills.split(",").map((s: string) => s.trim()) : []),
            // Add raw data for future processing
            raw_data: item
          };
        }).filter((opp): opp is any => opp !== null); // Remove null entries
        
        allOpportunities = [...allOpportunities, ...processedResults];
      } catch (actorError) {
        console.error(`[Discovery Agent] Failed to run Apify actor ${actor.name}:`, actorError);
        // Continue with other actors even if one fails
      }
    }

    // Deduplicate opportunities by URL (case insensitive)
    const seenUrls = new Set<string>();
    const deduplicatedOpportunities = allOpportunities.filter(opp => {
      const urlKey = opp.url.toLowerCase();
      if (seenUrls.has(urlKey)) {
        return false; // Duplicate, skip it
      }
      seenUrls.add(urlKey);
      return true;
    });

    // If no real data was found, fall back to mock data for demonstration
    const opportunitiesToUse = deduplicatedOpportunities.length > 0 ? deduplicatedOpportunities : [
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

    // Save to database (upsert will handle duplicates at DB level too)
    for (const opp of opportunitiesToUse) {
      await supabase.from("opportunities").upsert(opp, { onConflict: "url", ignoreDuplicates: true });
    }

    // Log successful completion
    await supabase.from("agent_logs").insert({
      agent_name: "webscout.discovery",
      action: "scraping_completed",
      details: { 
        opportunities_found: opportunitiesToUse.length,
        duplicates_removed: allOpportunities.length - deduplicatedOpportunities.length,
        source: opportunitiesToUse.length > 0 && allOpportunities.length === 0 ? "mock" : "apify"
      }
    });
    
    await logToSuperplane("webscout.discovery", null, "scraping_completed", { 
      opportunities_found: opportunitiesToUse.length,
      duplicates_removed: allOpportunities.length - deduplicatedOpportunities.length,
      source: opportunitiesToUse.length > 0 && allOpportunities.length === 0 ? "mock" : "apify"
    });

    return new Response(JSON.stringify({ 
      success: true, 
      opportunities: opportunitiesToUse,
      source: opportunitiesToUse.length > 0 && allOpportunities.length === 0 ? "mock" : "apify",
      stats: {
        totalFound: allOpportunities.length,
        afterDeduplication: deduplicatedOpportunities.length,
        finalCount: opportunitiesToUse.length
      }
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Discovery Agent] Error:", error);
    
    // Log error
    await supabase.from("agent_logs").insert({
      agent_name: "webscout.discovery",
      action: "error",
      details: { error: error.message }
    });
    
    await logToSuperplane("webscout.discovery", null, "error", { error: error.message });
    
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
