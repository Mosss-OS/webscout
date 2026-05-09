import { supabase } from "./supabase.ts";

const SUPERPLANE_API_KEY = Deno.env.get("SUPERPLANE_API_KEY");

export async function logToSuperplane(agentName: string, userId: string | null, action: string, details: any) {
  // 1. Log locally to our Supabase database for audit trails
  await supabase.from("agent_logs").insert({
    agent_name: agentName,
    user_id: userId,
    action: action,
    details: details
  });

  // 2. Transmit event to Superplane Control Plane (if configured)
  if (!SUPERPLANE_API_KEY) {
    // Superplane is optional but recommended for production
    console.info(`[Superplane] No API key provided, logging locally only for action: ${action}`);
    return;
  }

  try {
    await fetch("https://api.superplane.ai/v1/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPERPLANE_API_KEY}`
      },
      body: JSON.stringify({
        project: "webscout",
        agent: agentName,
        user_id: userId,
        action: action,
        payload: details,
        timestamp: new Date().toISOString()
      })
    });
  } catch (err) {
    console.error("[Superplane] Failed to send event:", err);
    // Don't throw here as we want the local logging to succeed even if Superplane fails
  }
}
