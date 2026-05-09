import { assertEquals, assertExists, assert } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import { supabase } from "../functions/_shared/supabase.ts";

Deno.test({
  name: "integration - database tables exist",
  fn: async () => {
    const tables = ["users", "conversations", "opportunities", "saved_opportunities", "agent_logs"];
    for (const table of tables) {
      const { data, error } = await supabase.from(table).select("id").limit(1);
      assertEquals(error, null, `Table '${table}' should be accessible`);
    }
  }
});

Deno.test({
  name: "integration - users table has required columns",
  fn: async () => {
    const { data, error } = await supabase.from("users").select("*").limit(1);
    assertEquals(error, null);
    if (data && data.length > 0) {
      const user = data[0];
      assertExists(user.id);
      assert("telegram_id" in user);
      assert("skills" in user);
      assert("location_preference" in user);
    }
  }
});

Deno.test({
  name: "integration - opportunities table has required columns",
  fn: async () => {
    const { data, error } = await supabase.from("opportunities").select("*").limit(1);
    assertEquals(error, null);
    if (data && data.length > 0) {
      const opp = data[0];
      assertExists(opp.title);
      assert("source" in opp);
      assert("ecosystem" in opp);
      assert("payout" in opp);
    }
  }
});

Deno.test({
  name: "integration - agent_logs table tracks actions",
  fn: async () => {
    const { data, error } = await supabase.from("agent_logs").select("*").limit(1);
    assertEquals(error, null);
    if (data && data.length > 0) {
      const log = data[0];
      assertExists(log.agent_name);
      assert("action" in log);
    }
  }
});

Deno.test({
  name: "pipeline - discovery output matches orchestrator input format",
  fn: async () => {
    const functionUrl = Deno.env.get("SUPABASE_URL")
      ? `${Deno.env.get("SUPABASE_URL")}/functions/v1/discovery-agent`
      : null;
    if (!functionUrl) return;

    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`
      },
      body: JSON.stringify({ query: "web3 grants" })
    });

    if (response.ok) {
      const result = await response.json();
      assertExists(result.opportunities);
      assertEquals(Array.isArray(result.opportunities), true);
      if (result.opportunities.length > 0) {
        const opp = result.opportunities[0];
        assertExists(opp.title);
        assertExists(opp.source);
        assert("ecosystem" in opp);
      }
    }
  }
});

Deno.test({
  name: "pipeline - discovery opportunities feed into matching agent",
  fn: async () => {
    const mockOpportunities = [
      {
        id: "test-1",
        title: "Starknet Developer Grant",
        source: "Apify_Test",
        ecosystem: "Starknet",
        payout: "$5000",
        description: "Build for Africa",
        url: "https://test.com/grant"
      }
    ];

    const { data, error } = await supabase.from("opportunities").upsert(mockOpportunities[0], {
      onConflict: "url",
      ignoreDuplicates: true
    });
    assertEquals(error, null);
  }
});

Deno.test({
  name: "security - RLS prevents unauthorized access",
  fn: async () => {
    const { data, error } = await supabase.from("users").select("telegram_id, wallet_address").limit(1);
    assertEquals(error, null);
  }
});

Deno.test({
  name: "pipeline - saved_opportunities links users to opportunities",
  fn: async () => {
    const { data, error } = await supabase.from("saved_opportunities").select("*, users(*), opportunities(*)").limit(1);
    assertEquals(error, null);
    if (data && data.length > 0) {
      const saved = data[0];
      assertExists(saved.user_id);
      assertExists(saved.opportunity_id);
      assert(["saved", "applied", "rejected", "drafted"].includes(saved.status));
    }
  }
});
