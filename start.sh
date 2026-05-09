#!/bin/bash
set -euo pipefail

echo "🚀 WebScout - Local Development"
echo "================================"

if [ ! -d "supabase" ]; then
  echo "❌ Run this from the project root."
  exit 1
fi

if [ ! -f ".env" ]; then
  echo "⚠️  .env not found. Copying .env.example..."
  cp .env.example .env
  echo "   Edit .env with your API keys before running the bot."
fi

cleanup() {
  echo ""
  echo "🛑 Shutting down..."
  kill $SUPABASE_PID 2>/dev/null || true
  kill $NEXTJS_PID 2>/dev/null || true
  npx supabase stop 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM

echo "📦 Starting Supabase..."
npx supabase start
SUPABASE_PID=$!
echo "   ✅ Supabase running (Studio: http://localhost:54323)"

echo "🤖 Serving Telegram Bot Edge Function..."
npx supabase functions serve telegram-bot --env-file .env --no-verify-jwt > supabase_function.log 2>&1 &
SUPABASE_PID=$!

echo "🌐 Starting Next.js Dashboard..."
cd dashboard
npm run dev &
NEXTJS_PID=$!
cd ..

echo ""
echo "✅ All services running:"
echo "   📊 Dashboard:    http://localhost:3000"
echo "   🗄  Supabase:     http://localhost:54323"
echo "   🤖 Bot Function: http://localhost:54321/functions/v1/telegram-bot"
echo ""
echo "Press [CTRL+C] to stop all services."

wait
