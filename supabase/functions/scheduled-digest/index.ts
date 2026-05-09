import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { supabase } from "../_shared/supabase.ts";
import { generateDigest } from "../_shared/superplane.ts";
import { rateLimitMiddleware } from "../_shared/rate-limiter.ts";

serve(rateLimitMiddleware(async (req) => {
  try {
    const { scheduled } = await req.json();

    const { data: users } = await supabase
      .from("users")
      .select("id, telegram_id, skills, location_preference");

    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ success: true, users_processed: 0 }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    const { data: opportunities } = await supabase
      .from("opportunities")
      .select("title, ecosystem, payout, id")
      .order("created_at", { ascending: false })
      .limit(20);

    if (!opportunities || opportunities.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        users_processed: 0,
        message: "No new opportunities to digest"
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    let processedCount = 0;
    for (const user of users) {
      const userSkills = (user.skills || []) as string[];
      const scoredOpps = opportunities.map(opp => {
        let score = 50;
        if (opp.ecosystem && userSkills.some(s =>
          opp.ecosystem!.toLowerCase().includes(s.toLowerCase())
        )) score += 20;
        return {
          title: opp.title,
          ecosystem: opp.ecosystem || "Unknown",
          payout: opp.payout || "TBD",
          match_score: score
        };
      });

      const digest = await generateDigest(user.id, scoredOpps);
      if (scheduled) {
        await supabase.from("conversations").insert({
          user_id: user.id,
          role: "assistant",
          content: digest
        });
      }
      processedCount++;
    }

    return new Response(JSON.stringify({
      success: true,
      users_processed: processedCount,
      opportunities_in_digest: opportunities.length
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Scheduled Digest] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}));
