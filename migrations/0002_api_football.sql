-- API-Football external identifiers and idempotent fixture storage.
ALTER TABLE leagues ADD COLUMN api_football_id INTEGER;
ALTER TABLE teams ADD COLUMN api_football_id INTEGER;
ALTER TABLE matches ADD COLUMN api_football_id INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS idx_leagues_api_football_id ON leagues(api_football_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_api_football_id ON teams(api_football_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_api_football_id ON matches(api_football_id);
