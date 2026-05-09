#!/bin/bash

# WebScout Startup Script
# This script will start both the Supabase backend (including Edge Functions)
# and the Next.js frontend dashboard.

echo "🚀 Starting WebScout..."

# Ensure we are in the project root
if [ ! -d "supabase" ]; then
    echo "❌ Error: Please run this script from the root of the webscout project directory."
    exit 1
fi

# Step 1: Start Supabase (Database, Auth, Edge Functions)
echo "📦 Starting Supabase..."
npx supabase start

# Note: The telegram-bot webhook needs to be served publicly for Telegram to reach it.
# For local testing, you typically run: npx supabase functions serve telegram-bot --env-file .env
# We'll run the function server in the background
echo "🤖 Serving Telegram Bot Edge Function locally..."
npx supabase functions serve telegram-bot --env-file .env --no-verify-jwt > supabase_function.log 2>&1 &
SUPABASE_PID=$!

# Step 2: Start Next.js Dashboard
echo "🌐 Starting Next.js Dashboard..."
cd dashboard
npm run dev &
NEXTJS_PID=$!

echo "✅ WebScout is running!"
echo "- Dashboard: http://localhost:3000"
echo "- Supabase Studio: http://localhost:54323"
echo "Press [CTRL+C] to stop all services."

# Trap CTRL+C and kill background processes
trap "echo 'Stopping services...'; kill $SUPABASE_PID; kill $NEXTJS_PID; npx supabase stop; exit" SIGINT

# Keep script running to maintain the background processes
wait
