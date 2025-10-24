-- Migration: Add ESPN player ID caching table
-- This table maps player names to their ESPN IDs to avoid repeated lookups

CREATE TABLE IF NOT EXISTS player_espn_ids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_name TEXT NOT NULL,
  espn_id TEXT NOT NULL,
  sport TEXT NOT NULL, -- 'football', 'basketball', 'baseball'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique combination of player name and sport
  UNIQUE(player_name, sport)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_player_espn_ids_lookup 
ON player_espn_ids(player_name, sport);

-- Index for ESPN ID lookups
CREATE INDEX IF NOT EXISTS idx_player_espn_ids_espn_id 
ON player_espn_ids(espn_id);

COMMENT ON TABLE player_espn_ids IS 'Cache ESPN player IDs to avoid repeated API lookups';
