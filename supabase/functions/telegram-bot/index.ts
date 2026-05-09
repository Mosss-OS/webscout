import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { webhookCallback } from "https://deno.land/x/grammy@v1.30.0/mod.ts";
import { bot } from "./bot.ts";
import { rateLimitMiddleware, checkRateLimit } from "../_shared/rate-limiter.ts";

const handleUpdate = webhookCallback(bot, "std/http");

serve(rateLimitMiddleware(async (req) => {
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("secret") !== Deno.env.get("FUNCTION_SECRET")) {
      return new Response("Not allowed", { status: 405 });
    }

    return await handleUpdate(req);
  } catch (err) {
    console.error(err);
    return new Response("Internal Server Error", { status: 500 });
  }
}));
