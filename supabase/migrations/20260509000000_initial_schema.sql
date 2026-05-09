-- Enable the pgvector extension to work with embedding vectors
CREATE EXTENSION IF NOT EXISTS vector;

-- Users Table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT UNIQUE NOT NULL,
  wallet_address TEXT UNIQUE,
  skills TEXT[] DEFAULT '{}',
  preferences JSONB DEFAULT '{}',
  location_preference TEXT DEFAULT 'Africa',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversations Table (Memory / Chat History)
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Opportunities Table (Raw & Processed)
CREATE TABLE opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL, -- e.g., 'Apify', 'Twitter', 'Upwork'
  title TEXT NOT NULL,
  description TEXT,
  payout TEXT,
  url TEXT UNIQUE NOT NULL,
  ecosystem TEXT, -- e.g., 'EVM', 'Starknet', 'Stellar', 'Polkadot'
  requirements TEXT[] DEFAULT '{}',
  is_processed BOOLEAN DEFAULT FALSE,
  raw_data JSONB,
  embedding VECTOR(1536), -- Optional: for future semantic search
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saved Opportunities (User Bookmarks)
CREATE TABLE saved_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'saved' CHECK (status IN ('saved', 'applied', 'rejected', 'drafted')),
  draft_content TEXT, -- Auto-generated application draft
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, opportunity_id)
);

-- Agent Logs Table (for Audit Trails / Superplane)
CREATE TABLE agent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  status TEXT CHECK (status IN ('success', 'failure', 'pending')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS POLICIES --

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;

-- Allow Edge Functions (Service Role) to bypass RLS, but restrict public/anon access.
-- We'll create policies assuming interactions happen primarily through Edge Functions using Service Role.
-- However, if users query directly via a frontend/app with their own JWT:
CREATE POLICY "Users can view their own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON users FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view their own conversations" ON conversations FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Opportunities are viewable by everyone" ON opportunities FOR SELECT USING (true);

CREATE POLICY "Users can view their own saved opportunities" ON saved_opportunities FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own saved opportunities" ON saved_opportunities FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own saved opportunities" ON saved_opportunities FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own saved opportunities" ON saved_opportunities FOR DELETE USING (auth.uid() = user_id);
