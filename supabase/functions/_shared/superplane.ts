import { supabase } from "./supabase.ts";

const SUPERPLANE_API_KEY = Deno.env.get("SUPERPLANE_API_KEY");

function getEventUrl(endpoint: string): string {
  const base = Deno.env.get("SUPERPLANE_BASE_URL") || "https://api.superplane.ai/v1";
  return `${base}/${endpoint}`;
}

async function sendToSuperplane(endpoint: string, body: any): Promise<void> {
  if (!SUPERPLANE_API_KEY) return;
  try {
    await fetch(getEventUrl(endpoint), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPERPLANE_API_KEY}`
      },
      body: JSON.stringify(body)
    });
  } catch (err) {
    console.error(`[Superplane] Failed to send to ${endpoint}:`, err);
  }
}

export async function logToSuperplane(agentName: string, userId: string | null, action: string, details: any) {
  await supabase.from("agent_logs").insert({
    agent_name: agentName,
    user_id: userId,
    action,
    details
  }).then(() => {}).catch(err => console.error("[Superplane] Local log failed:", err));

  await sendToSuperplane("events", {
    project: "webscout",
    agent: agentName,
    user_id: userId,
    action,
    payload: details,
    timestamp: new Date().toISOString()
  });
}

export interface AlertCandidate {
  opportunityId: string;
  userId: string;
  title: string;
  ecosystem: string;
  payout: string;
  matchScore: number;
}

export async function evaluateAlert(opp: AlertCandidate): Promise<boolean> {
  const score = opp.matchScore;
  const hasPayout = opp.payout !== "TBD" && opp.payout !== "";
  const payoutNum = parseInt(opp.payout.replace(/[^0-9]/g, ""));
  const highValue = hasPayout && !isNaN(payoutNum) && payoutNum >= 1000;
  const highScore = score >= 80;

  const triggered = highScore || (highValue && score >= 60);

  await supabase.from("agent_logs").insert({
    agent_name: "webscout.superplane",
    user_id: opp.userId,
    action: triggered ? "alert_triggered" : "alert_skipped",
    details: {
      opportunity_id: opp.opportunityId,
      title: opp.title,
      match_score: score,
      payout: opp.payout,
      reason: triggered
        ? (highScore ? "high_match_score" : "high_value")
        : "below_threshold"
    }
  });

  if (triggered) {
    await sendToSuperplane("workflows/trigger", {
      workflow: "high-value-opportunity",
      project: "webscout",
      user_id: opp.userId,
      payload: {
        opportunity_id: opp.opportunityId,
        title: opp.title,
        ecosystem: opp.ecosystem,
        payout: opp.payout,
        match_score: score
      },
      timestamp: new Date().toISOString()
    });
  }

  return triggered;
}

export interface DigestOpportunity {
  title: string;
  ecosystem: string;
  payout: string;
  match_score?: number;
}

export async function generateDigest(userId: string, opportunities: DigestOpportunity[]): Promise<string> {
  const topOpps = opportunities
    .sort((a, b) => (b.match_score || 50) - (a.match_score || 50))
    .slice(0, 5);

  const digestText = [
    `📋 *WebScout Weekly Digest*`,
    ``,
    `Here are your top opportunities this week:`,
    ``,
    ...topOpps.map((opp, i) => {
      const score = opp.match_score ? ` (${opp.match_score}% match)` : "";
      return `${i + 1}. *${opp.title}*${score}\n   Ecosystem: ${opp.ecosystem} | Payout: ${opp.payout}`;
    }),
    ``,
    `_Use /scout to refresh or /myprofile to update your preferences._`
  ].join("\n");

  await supabase.from("agent_logs").insert({
    agent_name: "webscout.superplane",
    user_id: userId,
    action: "digest_generated",
    details: { opportunity_count: topOpps.length }
  });

  await sendToSuperplane("workflows/trigger", {
    workflow: "weekly-digest",
    project: "webscout",
    user_id: userId,
    payload: {
      digest: digestText,
      opportunities: topOpps
    },
    timestamp: new Date().toISOString()
  });

  return digestText;
}

export interface GuardrailCheck {
  agentName: string;
  userId: string | null;
  action: string;
  input: any;
}

export async function checkGuardrails(check: GuardrailCheck): Promise<{ passed: boolean; reason?: string }> {
  if (!SUPERPLANE_API_KEY) return { passed: true };

  try {
    const response = await fetch(getEventUrl("guardrails/check"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPERPLANE_API_KEY}`
      },
      body: JSON.stringify({
        project: "webscout",
        agent: check.agentName,
        user_id: check.userId,
        action: check.action,
        input: check.input,
        timestamp: new Date().toISOString()
      })
    });

    if (!response.ok) return { passed: true };
    return await response.json();
  } catch {
    return { passed: true };
  }
}
