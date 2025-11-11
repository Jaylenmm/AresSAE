-- Create table for cached NBA player stats
CREATE TABLE IF NOT EXISTS nba_player_stats_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_name TEXT NOT NULL UNIQUE,
  player_display_name TEXT NOT NULL,
  stats_data JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_nba_stats_player_name ON nba_player_stats_cache(player_name);
CREATE INDEX IF NOT EXISTS idx_nba_stats_updated_at ON nba_player_stats_cache(updated_at);

-- Enable RLS
ALTER TABLE nba_player_stats_cache ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access" ON nba_player_stats_cache
  FOR SELECT
  TO public
  USING (true);

-- Allow public insert/update access (for cron job)
CREATE POLICY "Allow public insert access" ON nba_player_stats_cache
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access" ON nba_player_stats_cache
  FOR UPDATE
  TO public
  USING (true);

-- Comment
COMMENT ON TABLE nba_player_stats_cache IS 'Cached NBA player statistics from NBA.com API';
