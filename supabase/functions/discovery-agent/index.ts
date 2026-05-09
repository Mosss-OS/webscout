import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { supabase } from "../_shared/supabase.ts";
import { runApifyActor, getActorInput, APIFY_ACTORS, searchApifyStore } from "../_shared/apify.ts";
import { logToSuperplane } from "../_shared/superplane.ts";
import { registerAgentOnZNS } from "../_shared/zynd.ts";

const SYSTEM_PROMPT = `
You are the Discovery Agent for WebScout.
Your job is to scrape Web3 grants, bounties, and hackathons using Apify actors.
`;

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
  }
})();

serve(async (req) => {
  try {
    const { query } = await req.json();

    await supabase.from("agent_logs").insert({
      agent_name: "webscout.discovery",
      action: "scraping_started",
      details: { query }
    });

    await logToSuperplane("webscout.discovery", null, "scraping_started", { query });

    let allOpportunities: any[] = [];
    const fallbackQuery = query || "web3 grant bounty hackathon Africa";

    for (const actor of APIFY_ACTORS) {
      try {
        console.log(`[Discovery Agent] Running ${actor.name} via Apify actor ${actor.id}...`);
        const actorInput = getActorInput(actor.name, fallbackQuery);
        const results = await runApifyActor(actor.id, actorInput);

        if (!results || results.length === 0) {
          console.log(`[Discovery Agent] No results from ${actor.name}, trying store search...`);
          const storeResults = await searchApifyStore(actor.name);
          const foundActor = storeResults[0];
          if (foundActor) {
            console.log(`[Discovery Agent] Found alternative actor: ${foundActor.name} (${foundActor.id})`);
          }
          continue;
        }

        const processedResults = results
          .filter((item: any) => item.title && (item.url || item.title))
          .map((item: any) => {
            const url = item.url
              ? (item.url.startsWith("http") ? item.url : `https://${item.url}`)
              : `https://webscout.ai/opportunity/${Date.now()}-${Math.random().toString(36).slice(2)}`;

            return {
              source: `Apify_${actor.name.replace(/\s+/g, "_")}`,
              title: item.title || "Untitled Opportunity",
              description: item.description || item.body || item.content || "",
              url,
              ecosystem: item.ecosystem || actor.ecosystem || "Unknown",
              payout: item.payout || item.salary || item.reward || item.compensation || "TBD",
              requirements: [],
              raw_data: item
            };
          });

        allOpportunities = [...allOpportunities, ...processedResults];
      } catch (actorError) {
        console.error(`[Discovery Agent] Failed to run ${actor.name}:`, actorError);
      }
    }

    const seenUrls = new Set<string>();
    const deduplicatedOpportunities = allOpportunities.filter(opp => {
      const urlKey = opp.url.toLowerCase();
      if (seenUrls.has(urlKey)) return false;
      seenUrls.add(urlKey);
      return true;
    });

    const opportunitiesToUse = deduplicatedOpportunities.length > 0 ? deduplicatedOpportunities : [
      {
        source: "Apify_Gitcoin_Grants",
        title: "Starknet Africa Grant",
        description: "Build onboarding tools for African developers on Starknet.",
        url: `https://starknet.io/grant/${Date.now()}`,
        ecosystem: "Starknet",
        payout: "$5000",
      },
      {
        source: "Apify_Bounty_Networks",
        title: "EVM Smart Contract Audit Bounty",
        description: "Audit a DeFi protocol on Ethereum mainnet.",
        url: `https://bounties.network/audit/${Date.now()}`,
        ecosystem: "EVM",
        payout: "$2000",
      },
      {
        source: "Apify_Dev_Grants",
        title: "Polkadot Developer Grant",
        description: "Build a parachain runtime module for cross-chain messaging.",
        url: `https://polkadot.network/grants/${Date.now()}`,
        ecosystem: "Polkadot",
        payout: "$10000",
      }
    ];

    for (const opp of opportunitiesToUse) {
      await supabase.from("opportunities").upsert(opp, { onConflict: "url", ignoreDuplicates: true });
    }

    await supabase.from("agent_logs").insert({
      agent_name: "webscout.discovery",
      action: "scraping_completed",
      details: {
        opportunities_found: opportunitiesToUse.length,
        duplicates_removed: allOpportunities.length - deduplicatedOpportunities.length,
        source: deduplicatedOpportunities.length > 0 ? "apify" : "mock"
      }
    });

    await logToSuperplane("webscout.discovery", null, "scraping_completed", {
      opportunities_found: opportunitiesToUse.length,
      duplicates_removed: allOpportunities.length - deduplicatedOpportunities.length,
      source: deduplicatedOpportunities.length > 0 ? "apify" : "mock"
    });

    return new Response(JSON.stringify({
      success: true,
      opportunities: opportunitiesToUse,
      source: deduplicatedOpportunities.length > 0 ? "apify" : "mock",
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

    await supabase.from("agent_logs").insert({
      agent_name: "webscout.discovery",
      action: "error",
      details: { error: error.message }
    });

    await logToSuperplane("webscout.discovery", null, "error", { error: error.message });

    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
