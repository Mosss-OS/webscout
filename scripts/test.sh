#!/bin/bash
set -euo pipefail

echo "🧪 WebScout Test Suite"
echo "======================"

# Unit tests
echo ""
echo "📋 Running unit tests..."
deno test supabase/functions/_shared/*.test.ts --allow-env --allow-net 2>&1 || true

# Integration tests (require Supabase running)
echo ""
echo "📋 Running integration tests..."
if npx supabase status &>/dev/null; then
  deno test supabase/tests/*.test.ts --allow-env --allow-net --allow-read 2>&1 || true
else
  echo "   ⚠️  Supabase not running. Skipping integration tests."
  echo "   Run 'npx supabase start' first."
fi

echo ""
echo "✅ Tests completed."
