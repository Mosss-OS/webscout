#!/bin/bash
set -euo pipefail

echo "🚀 WebScout Deployment Script"
echo "=============================="

if [ ! -f ".env" ]; then
  echo "❌ .env file not found. Copy .env.example to .env and fill in your keys."
  exit 1
fi

source .env

: "${SUPABASE_PROJECT_ID:?SUPABASE_PROJECT_ID is required}"
: "${TELEGRAM_BOT_TOKEN:?TELEGRAM_BOT_TOKEN is required}"

echo ""
echo "📦 Step 1: Linking Supabase project..."
npx supabase link --project-ref "$SUPABASE_PROJECT_ID"

echo ""
echo "📦 Step 2: Pushing database migrations..."
npx supabase db push

echo ""
echo "📦 Step 3: Setting secrets..."
npx supabase secrets set TELEGRAM_BOT_TOKEN="$TELEGRAM_BOT_TOKEN"
npx supabase secrets set APIFY_API_TOKEN="${APIFY_API_TOKEN:-}"
npx supabase secrets set ZYND_API_KEY="${ZYND_API_KEY:-}"
npx supabase secrets set SUPERPLANE_API_KEY="${SUPERPLANE_API_KEY:-}"
npx supabase secrets set OPENAI_API_KEY="${OPENAI_API_KEY:-}"
npx supabase secrets set FUNCTION_SECRET="${FUNCTION_SECRET:-$(openssl rand -hex 32)}"
echo "   ✅ Secrets set"

echo ""
echo "📦 Step 4: Deploying Edge Functions..."
FUNCTIONS=("telegram-bot" "agent-orchestrator" "discovery-agent" "matching-agent" "action-agent" "scheduled-digest")
for fn in "${FUNCTIONS[@]}"; do
  echo "   Deploying $fn..."
  npx supabase functions deploy "$fn" --no-verify-jwt
done

echo ""
echo "📦 Step 5: Setting Telegram webhook..."
SUPABASE_URL=$(npx supabase status --output json 2>/dev/null | grep -o '"api_url":"[^"]*"' | cut -d'"' -f4 || echo "")
if [ -z "$SUPABASE_URL" ]; then
  SUPABASE_URL="https://${SUPABASE_PROJECT_ID}.supabase.co"
fi
WEBHOOK_URL="${SUPABASE_URL}/functions/v1/telegram-bot?secret=${FUNCTION_SECRET}"
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=${WEBHOOK_URL}" | jq .
echo "   ✅ Webhook configured"

echo ""
echo "✅ Deployment complete!"
echo "   Bot webhook: $WEBHOOK_URL"
