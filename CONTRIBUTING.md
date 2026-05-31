# Contributing to WebScout

## Setup
1. Clone the repo
2. Copy `.env.example` to `.env` and fill in values
3. Run `npx supabase start` (requires Docker)
4. Run `./start.sh`

## Code conventions
- TypeScript strict mode
- Deno for edge functions, Next.js for dashboard
- Follow existing patterns in `supabase/functions/_shared/`

## Pull request process
1. Create a feature branch from `main`
2. Make your changes
3. Run `npx supabase functions serve` and verify no errors
4. Open a PR against `main` with a clear description

## Adding a new agent
1. Create `supabase/functions/<agent-name>/index.ts`
2. Register with Zynd (see `_shared/zynd.ts`)
3. Add logging via Superplane (see `_shared/superplane.ts`)
4. Add env vars to `.env.example`

## Need help?
Open a discussion or good-first-issue tagged issue.
