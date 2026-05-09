import { Bot, Context, session, InlineKeyboard } from "https://deno.land/x/grammy@v1.30.0/mod.ts";
import { supabase } from "../_shared/supabase.ts";
import { isValidWalletAddress, detectWalletType } from "../_shared/web3.ts";

interface SessionData {
  awaitingWalletInput: boolean;
  awaitingLocationInput: boolean;
  awaitingSkillsInput: boolean;
}

type MyContext = Context & { session: SessionData; dbUser?: any };

const requiredEnvVars = ["TELEGRAM_BOT_TOKEN", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
for (const varName of requiredEnvVars) {
  if (!Deno.env.get(varName)) {
    throw new Error(`${varName} is not set`);
  }
}

const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
export const bot = new Bot<MyContext>(botToken);

function initialSession(): SessionData {
  return { awaitingWalletInput: false, awaitingLocationInput: false, awaitingSkillsInput: false };
}

bot.use(session({ initial: initialSession }));

bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Error handling update ${ctx.update.update_id}:`, err.error);
});

bot.use(async (ctx, next) => {
  const telegramId = ctx.from?.id;
  if (telegramId) {
    const { data: user, error } = await supabase
      .from("users")
      .upsert({ telegram_id: telegramId }, { onConflict: "telegram_id", ignoreDuplicates: false })
      .select()
      .single();
    if (error) console.error("Error upserting user:", error);
    ctx.dbUser = user;
  }
  await next();
});

bot.command("start", async (ctx) => {
  await ctx.replyWithChatAction("typing");
  await ctx.reply(
    "👋 *Welcome to WebScout!*\n\n"
    + "I'm your autonomous AI agent designed to help Web3 builders in Africa find, evaluate, and act on the best opportunities.\n\n"
    + "Here's what I can do:\n"
    + "🔹 `/scout` - Find the latest Web3 grants, bounties, and hackathons\n"
    + "🔹 `/myprofile` - Set your skills, location, and wallet\n"
    + "🔹 `/digest` - Generate a personalized weekly digest\n"
    + "🔹 `/help` - Show all commands\n\n"
    + "_Let's get started\\! Use /myprofile to set up your profile first\\._",
    { parse_mode: "MarkdownV2" }
  );
});

bot.command("help", async (ctx) => {
  await ctx.replyWithChatAction("typing");
  await ctx.reply(
    "🤖 *WebScout Commands*\n\n"
    + "🔹 `/start` - Welcome and overview\n"
    + "🔹 `/help` - Show this help menu\n"
    + "🔹 `/myprofile` - View/edit your skills, location & wallet\n"
    + "🔹 `/scout` - Search for new Web3 opportunities\n"
    + "🔹 `/digest` - Generate your weekly digest\n\n"
    + "_You can also just type a message naturally and I'll do my best to help\\!_",
    { parse_mode: "MarkdownV2" }
  );
});

bot.command("myprofile", async (ctx) => {
  await ctx.replyWithChatAction("typing");
  const user = ctx.dbUser;

  const skills = user?.skills?.length ? user.skills.join(", ") : "Not set";
  const wallet = user?.wallet_address ? `\`${user.wallet_address.slice(0, 6)}...${user.wallet_address.slice(-4)}\`` : "Not set";

  const profileText =
    "👤 *Your Profile*\n\n"
    + `📍 *Location:* ${user?.location_preference || "Not set"}\n`
    + `🛠 *Skills:* ${skills}\n`
    + `👛 *Wallet:* ${wallet}\n\n`
    + `_Select an option below to update your profile\\._`;

  const keyboard = new InlineKeyboard()
    .text("📍 Update Location", "profile_location").row()
    .text("🛠 Update Skills", "profile_skills").row()
    .text("👛 Link Wallet", "profile_wallet");

  await ctx.reply(profileText, { parse_mode: "MarkdownV2", reply_markup: keyboard });
});

bot.command("scout", async (ctx) => {
  await ctx.replyWithChatAction("typing");
  const user = ctx.dbUser;

  const msg = await ctx.reply(
    "🔍 *Scouting for opportunities\\.\\.\\.*\n\n"
    + "I'm activating the Discovery Agent to scrape Web3 grants, bounties, and hackathons across multiple ecosystems\\.\n"
    + "⏳ *This may take up to 30 seconds*\\.\\.\\.",
    { parse_mode: "MarkdownV2" }
  );

  try {
    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/agent-orchestrator`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`
        },
        body: JSON.stringify({
          userId: user?.id,
          query: "Find the latest web3 opportunities",
          action: "scout"
        })
      }
    );

    if (!response.ok) throw new Error(`Orchestrator returned ${response.status}`);

    const result = await response.json();
    const opps = result?.result?.matched_opportunities || [];

    if (opps.length === 0) {
      await ctx.api.editMessageText(
        ctx.chat!.id,
        msg.message_id,
        "😕 *No new opportunities found*\n\nI searched across multiple sources but couldn't find any relevant opportunities right now\\. Try again later\\.",
        { parse_mode: "MarkdownV2" }
      );
      return;
    }

    const topOpps = opps.slice(0, 5);
    const oppsList = topOpps.map((opp: any, i: number) =>
      `${i + 1}\\. *${opp.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}*\n`
      + `   Ecosystem: ${opp.ecosystem}  |  Payout: ${opp.payout}  |  Match: ${opp.match_score}%`
    ).join("\n\n");

    const keyboard = new InlineKeyboard()
      .text("🔄 Refresh", "action_refresh_opportunities");

    await ctx.api.editMessageText(
      ctx.chat!.id,
      msg.message_id,
      `✅ *Scouting complete\\! Found ${opps.length} opportunities*\n\n${oppsList}\n\n_Opportunities are already saved to your dashboard\\._`,
      { parse_mode: "MarkdownV2", reply_markup: keyboard }
    );
  } catch (error) {
    console.error("Scout error:", error);
    await ctx.api.editMessageText(
      ctx.chat!.id,
      msg.message_id,
      "❌ *Scouting failed*\n\nI encountered an error while searching for opportunities\\. Please try `/scout` again\\.",
      { parse_mode: "MarkdownV2" }
    );
  }
});

bot.command("digest", async (ctx) => {
  await ctx.replyWithChatAction("typing");
  const user = ctx.dbUser;

  await ctx.reply("📋 *Generating your personalized digest\\.\\.\\.*", { parse_mode: "MarkdownV2" });

  try {
    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/scheduled-digest`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`
        },
        body: JSON.stringify({ scheduled: false })
      }
    );

    if (!response.ok) throw new Error(`Digest returned ${response.status}`);

    const { data: opportunities } = await supabase
      .from("opportunities")
      .select("title, ecosystem, payout")
      .order("created_at", { ascending: false })
      .limit(5);

    const userSkills = (user?.skills || []) as string[];
    const scoredOpps = (opportunities || []).map(opp => {
      let score = 50;
      if (userSkills.some(s =>
        (opp.ecosystem || "").toLowerCase().includes(s.toLowerCase())
      )) score += 20;
      return { ...opp, match_score: score };
    }).sort((a: any, b: any) => b.match_score - a.match_score);

    const digest = [
      "📋 *Your WebScout Digest*\n",
      ...scoredOpps.map((opp, i) =>
        `${i + 1}\\. *${opp.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}*\n`
        + `   Ecosystem: ${opp.ecosystem}  |  Payout: ${opp.payout}  |  Match: ${opp.match_score}%`
      ),
      "\n_Use /scout to find more opportunities\\!_"
    ].join("\n");

    await ctx.reply(digest, { parse_mode: "MarkdownV2" });
  } catch (error) {
    console.error("Digest error:", error);
    await ctx.reply(
      "❌ *Could not generate digest*\n\nTry again later or use `/scout` to find opportunities directly\\.",
      { parse_mode: "MarkdownV2" }
    );
  }
});

// Inline Query Callbacks
bot.callbackQuery("profile_location", async (ctx) => {
  ctx.session.awaitingLocationInput = true;
  await ctx.answerCallbackQuery();
  await ctx.reply(
    "📍 Please reply with your location (e.g., *Nigeria*, *Kenya*, *South Africa*).",
    { parse_mode: "MarkdownV2" }
  );
});

bot.callbackQuery("profile_skills", async (ctx) => {
  ctx.session.awaitingSkillsInput = true;
  await ctx.answerCallbackQuery();
  await ctx.reply(
    "🛠 Reply with your Web3 skills separated by commas (e.g., *Solidity, React, Cairo, Rust*).",
    { parse_mode: "MarkdownV2" }
  );
});

bot.callbackQuery("profile_wallet", async (ctx) => {
  ctx.session.awaitingWalletInput = true;
  await ctx.answerCallbackQuery();
  await ctx.reply(
    "👛 Reply with your wallet address (Ethereum `0x...` or Starknet `0x...`).",
    { parse_mode: "MarkdownV2" }
  );
});

bot.callbackQuery("action_refresh_opportunities", async (ctx) => {
  await ctx.answerCallbackQuery("Refreshing...");
  await ctx.replyWithChatAction("typing");
  await ctx.reply(
    "🔄 *Refreshing opportunities\\.\\.\\.*\n\nUse `/scout` to run a full search with the Discovery Agent\\.",
    { parse_mode: "MarkdownV2" }
  );
});

bot.callbackQuery(/opp_save_.*/, async (ctx) => {
  await ctx.answerCallbackQuery("Opportunity saved!");
  const keyboard = new InlineKeyboard().text("✅ Saved", "noop").text("📝 Generate Draft", "noop_draft");
  await ctx.editMessageReplyMarkup({ reply_markup: keyboard });
});

bot.callbackQuery(/opp_apply_.*/, async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.replyWithChatAction("typing");
  await ctx.reply("📝 *Generating application draft\\.\\.\\.*", { parse_mode: "MarkdownV2" });
});

// Catch-all for unknown callback queries
bot.callbackQuery(/.*/, async (ctx) => {
  await ctx.answerCallbackQuery();
});

bot.on("message:text", async (ctx) => {
  await ctx.replyWithChatAction("typing");
  const user = ctx.dbUser;
  const messageText = ctx.message.text;

  // Wallet input
  if (ctx.session.awaitingWalletInput) {
    ctx.session.awaitingWalletInput = false;
    if (isValidWalletAddress(messageText)) {
      const walletType = detectWalletType(messageText);
      await supabase.from("users").update({ wallet_address: messageText }).eq("id", user.id);
      await ctx.reply(
        `✅ *Wallet linked\\!*\n\nType: *${walletType.charAt(0).toUpperCase() + walletType.slice(1)}*\nAddress: \`${messageText.slice(0, 6)}...${messageText.slice(-4)}\``,
        { parse_mode: "MarkdownV2" }
      );
    } else {
      await ctx.reply(
        "❌ That doesn't look like a valid wallet address\\.\n\n"
        + "Please provide an Ethereum address (starting with `0x`, 42 characters) "
        + "or a Starknet address (starting with `0x`, 66 characters)."
      );
    }
    return;
  }

  // Location input
  if (ctx.session.awaitingLocationInput) {
    ctx.session.awaitingLocationInput = false;
    await supabase.from("users").update({ location_preference: messageText }).eq("id", user.id);
    await ctx.reply(
      `✅ *Location updated\\!*\n\nYour location is now set to: *${messageText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}*`,
      { parse_mode: "MarkdownV2" }
    );
    return;
  }

  // Skills input
  if (ctx.session.awaitingSkillsInput) {
    ctx.session.awaitingSkillsInput = false;
    const skillsList = messageText.split(",").map(s => s.trim()).filter(s => s.length > 0);
    if (skillsList.length > 0) {
      await supabase.from("users").update({ skills: skillsList }).eq("id", user.id);
      const escaped = skillsList.join(", ").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      await ctx.reply(`✅ *Skills updated\\!*\n\nYour skills: *${escaped}*`, { parse_mode: "MarkdownV2" });
    } else {
      await ctx.reply("Please provide at least one skill separated by commas.");
    }
    return;
  }

  // Save message to memory
  if (user?.id) {
    await supabase.from("conversations").insert({
      user_id: user.id,
      role: "user",
      content: messageText
    });
  }

  // Natural language processing via orchestrator
  const isScoutRequest = /find|search|scout|opportunit|grant|bounty|hackathon|job/i.test(messageText);
  const isApplyRequest = /apply|draft|submit|application|proposal/i.test(messageText);
  const action = isApplyRequest ? "apply" : isScoutRequest ? "scout" : null;

  let responseMsg = "";
  if (action === "scout") {
    responseMsg = "🔍 *Starting opportunity search\\.\\.\\.*\n\nI'll search across multiple ecosystems for opportunities matching your profile\\. This may take a moment\\.";
    await ctx.reply(responseMsg, { parse_mode: "MarkdownV2" });
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/agent-orchestrator`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`
        },
        body: JSON.stringify({ userId: user?.id, query: messageText, action: "scout" })
      });
    } catch {
      // Fire and forget - the scout command will show results
    }
    return;
  } else if (action === "apply") {
    await ctx.reply(
      "📝 I'll need to know which opportunity you'd like to apply for\\.\n"
      + "Please use `/scout` first to find opportunities, then save them\\.",
      { parse_mode: "MarkdownV2" }
    );
    return;
  } else {
    responseMsg = "🤔 I'm not sure how to help with that yet\\. Try one of these commands:\n\n"
      + "🔹 `/scout` - Find Web3 opportunities\n"
      + "🔹 `/myprofile` - Set up your profile\n"
      + "🔹 `/help` - See all commands";
  }

  if (user?.id) {
    await supabase.from("conversations").insert({
      user_id: user.id,
      role: "assistant",
      content: responseMsg
    });
  }

  await ctx.reply(responseMsg, { parse_mode: "MarkdownV2" });
});
