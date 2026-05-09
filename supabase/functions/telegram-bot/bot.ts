import { Bot, Context, session, InlineKeyboard } from "https://deno.land/x/grammy@v1.30.0/mod.ts";
import { supabase } from "../_shared/supabase.ts";
import { isValidWalletAddress, detectWalletType } from "../_shared/web3.ts";

interface SessionData {
  awaitingWalletInput: boolean;
  awaitingLocationInput: boolean;
  awaitingSkillsInput: boolean;
}

type MyContext = Context & { session: SessionData; dbUser?: any };

// Validate required environment variables
const requiredEnvVars = ["TELEGRAM_BOT_TOKEN", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
for (const varName of requiredEnvVars) {
  if (!Deno.env.get(varName)) {
    throw new Error(`${varName} is not set`);
  }
}

const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
export const bot = new Bot<MyContext>(botToken);

// Initialize session
function initialSession(): SessionData {
  return { awaitingWalletInput: false, awaitingLocationInput: false, awaitingSkillsInput: false };
}

bot.use(session({ initial: initialSession }));

// Error handler
bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Error while handling update ${ctx.update.update_id}:`, err.error);
});

// Middleware to ensure user exists and attach to ctx
bot.use(async (ctx, next) => {
  const telegramId = ctx.from?.id;
  if (telegramId) {
    const { data: user, error } = await supabase
      .from("users")
      .upsert({ telegram_id: telegramId }, { onConflict: "telegram_id", ignoreDuplicates: false })
      .select()
      .single();
    
    if (error) console.error("Error upserting user:", error);
    // @ts-ignore: Custom context property
    ctx.dbUser = user;
  }
  await next();
});

// Command: /start
bot.command("start", async (ctx) => {
  await ctx.replyWithChatAction("typing");
  await ctx.reply(
    "👋 *Welcome to WebScout!*\n\n" +
    "I'm your autonomous AI agent designed to help Web3 builders in Africa find, evaluate, and act on the best opportunities.\n\n" +
    "Let's get started\\! Use /myprofile to set up your skills and location, or /scout to start finding opportunities\\.",
    { parse_mode: "MarkdownV2" }
  );
});

// Command: /help
bot.command("help", async (ctx) => {
  await ctx.replyWithChatAction("typing");
  await ctx.reply(
    "🤖 *WebScout Commands*\n\n" +
    "🔹 /start \\- Start or restart the bot\n" +
    "🔹 /help \\- Show this help menu\n" +
    "🔹 /myprofile \\- Manage your skills & preferences\n" +
    "🔹 /scout \\- Search for new opportunities\n\n" +
    "_Need more help? Just type your question naturally\\!_",
    { parse_mode: "MarkdownV2" }
  );
});

// Command: /myprofile
bot.command("myprofile", async (ctx) => {
  await ctx.replyWithChatAction("typing");
  // @ts-ignore
  const user = ctx.dbUser;
  
  const profileText = `👤 *Your Profile*\n\n` +
    `*Location:* ${user?.location_preference || "Not set"}\n` +
    `*Skills:* ${user?.skills && user.skills.length > 0 ? user.skills.join(", ") : "Not set"}\n` +
    `*Wallet:* ${user?.wallet_address ? `\`${user.wallet_address}\`` : "Not set"}\n\n` +
    `_Select an option below to update your profile\\._`;

  const keyboard = new InlineKeyboard()
    .text("📍 Update Location", "profile_location").row()
    .text("🛠 Update Skills", "profile_skills").row()
    .text("👛 Link Wallet", "profile_wallet");

  await ctx.reply(profileText, { parse_mode: "MarkdownV2", reply_markup: keyboard });
});

// Command: /scout
bot.command("scout", async (ctx) => {
  await ctx.replyWithChatAction("typing");
  
  const keyboard = new InlineKeyboard()
    .text("Refresh Opportunities", "action_refresh_opportunities");

  await ctx.reply(
    "🔍 *Scouting Opportunities*\n\n" +
    "I'm waking up the *Discovery Agent* to scour Apify sources for the latest grants, bounties, and hackathons\\.\n\n" +
    "_This might take a moment\\._",
    { parse_mode: "MarkdownV2", reply_markup: keyboard }
  );

  // Invoke the Orchestrator Agent
  try {
    // @ts-ignore
    const user = ctx.dbUser;
    // We would typically dispatch this asynchronously, but for demo we can fire and forget
    // using the zynd discovery mechanism or direct function invocation.
    fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/agent-orchestrator`, {
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
    }).catch(console.error);
  } catch (error) {
    console.error("Failed to invoke orchestrator:", error);
  }
});

// Inline Query Callbacks
bot.callbackQuery("profile_location", async (ctx) => {
  ctx.session.awaitingLocationInput = true;
  await ctx.answerCallbackQuery();
  await ctx.reply("Please reply to this message with your location (e.g., 'Nigeria', 'Kenya').", { parse_mode: "MarkdownV2" });
});

bot.callbackQuery("profile_skills", async (ctx) => {
  ctx.session.awaitingSkillsInput = true;
  await ctx.answerCallbackQuery();
  await ctx.reply("What are your primary Web3 skills? (e.g., 'Solidity, React, Starknet')", { parse_mode: "MarkdownV2" });
});

bot.callbackQuery("profile_wallet", async (ctx) => {
  ctx.session.awaitingWalletInput = true;
  await ctx.answerCallbackQuery();
  await ctx.reply("Please reply to this message with your Ethereum or Starknet wallet address.", { parse_mode: "MarkdownV2" });
});

bot.callbackQuery("action_refresh_opportunities", async (ctx) => {
  await ctx.answerCallbackQuery("Refreshing...");
  await ctx.replyWithChatAction("typing");
  
  // Example dummy opportunity
  const oppKeyboard = new InlineKeyboard()
    .text("💾 Save", "opp_save_123")
    .text("📝 Apply Draft", "opp_apply_123");

  await ctx.reply(
    "🏆 *Example Web3 Grant*\n" +
    "Ecosystem: *Starknet*\n" +
    "Payout: *$5,000*\n\n" +
    "Build a decentralized identity solution for African creators\\.",
    { parse_mode: "MarkdownV2", reply_markup: oppKeyboard }
  );
});

bot.callbackQuery(/opp_save_.*/, async (ctx) => {
  await ctx.answerCallbackQuery("Opportunity saved!");
  await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard().text("✅ Saved", "noop").text("📝 Apply Draft", "opp_apply_123") });
});

bot.callbackQuery(/opp_apply_.*/, async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.replyWithChatAction("typing");
  await ctx.reply("Generating an application draft using your profile... ⏳");
});

// Fallback for natural language / conversational memory and profile inputs
bot.on("message:text", async (ctx) => {
  await ctx.replyWithChatAction("typing");
  
  const user = ctx.dbUser;
  const messageText = ctx.message.text;

  // Handle wallet address input
  if (ctx.session.awaitingWalletInput) {
    ctx.session.awaitingWalletInput = false;
    if (isValidWalletAddress(messageText)) {
      const walletType = detectWalletType(messageText);
      await supabase.from("users").update({ wallet_address: messageText }).eq("id", user.id);
      await ctx.reply(
        `✅ *Wallet linked successfully!*\n\nType: *${walletType.charAt(0).toUpperCase() + walletType.slice(1)}*\nAddress: \`${messageText.slice(0, 10)}...${messageText.slice(-4)}\``,
        { parse_mode: "MarkdownV2" }
      );
    } else {
      await ctx.reply("❌ That doesn't look like a valid wallet address. Please provide a valid Ethereum (0x...) or Starknet address.");
    }
    return;
  }

  // Handle location input
  if (ctx.session.awaitingLocationInput) {
    ctx.session.awaitingLocationInput = false;
    const validLocations = ["Nigeria", "Kenya", "South Africa", "Ghana", "Ethiopia", "Rwanda", "Uganda", "Egypt", "Morocco", "Tanzania", "Zimbabwe", "Zambia"];
    const matchedLocation = validLocations.find(l => l.toLowerCase() === messageText.toLowerCase());
    if (matchedLocation) {
      await supabase.from("users").update({ location_preference: matchedLocation }).eq("id", user.id);
      await ctx.reply(`✅ Location set to *${matchedLocation}*!`, { parse_mode: "MarkdownV2" });
    } else {
      await supabase.from("users").update({ location_preference: messageText }).eq("id", user.id);
      await ctx.reply(`✅ Location set to *${messageText}*!`, { parse_mode: "MarkdownV2" });
    }
    return;
  }

  // Handle skills input
  if (ctx.session.awaitingSkillsInput) {
    ctx.session.awaitingSkillsInput = false;
    const skillsList = messageText.split(",").map(s => s.trim()).filter(s => s.length > 0);
    if (skillsList.length > 0) {
      await supabase.from("users").update({ skills: skillsList }).eq("id", user.id);
      await ctx.reply(`✅ Skills updated: *${skillsList.join(", ")}*`, { parse_mode: "MarkdownV2" });
    } else {
      await ctx.reply("Please provide at least one skill, separated by commas.");
    }
    return;
  }

  // Save user message to memory
  if (user?.id) {
    await supabase.from("conversations").insert({
      user_id: user.id,
      role: "user",
      content: messageText
    });
  }

  // Forward to Orchestrator for NLU processing
  let responseMsg = "";
  try {
    const orchestratorResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/agent-orchestrator`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`
      },
      body: JSON.stringify({
        userId: user?.id,
        query: messageText,
        action: messageText.toLowerCase().includes("apply") ? "apply" : "scout"
      })
    });
    if (orchestratorResponse.ok) {
      const result = await orchestratorResponse.json();
      responseMsg = result.result?.matched_opportunities
        ? `Found ${result.result.matched_opportunities.length} matching opportunities! Use /scout to see them.`
        : "Processing your request through the agent network...";
    } else {
      responseMsg = "I'm routing your request to the agent network. This might take a moment.";
    }
  } catch (error) {
    console.error("Failed to invoke orchestrator:", error);
    responseMsg = "I'm processing your request. Check back with /scout for new opportunities!";
  }

  // Save assistant message to memory
  if (user?.id) {
    await supabase.from("conversations").insert({
      user_id: user.id,
      role: "assistant",
      content: responseMsg
    });
  }

  await ctx.reply(responseMsg);
});
