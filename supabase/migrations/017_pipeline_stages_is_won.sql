-- Add is_won column to pipeline_stages
ALTER TABLE pipeline_stages
  ADD COLUMN IF NOT EXISTS is_won BOOLEAN NOT NULL DEFAULT false;

-- Drop the old binary constraint (is_lost ↔ is_referral only)
ALTER TABLE pipeline_stages
  DROP CONSTRAINT IF EXISTS pipeline_stages_not_lost_and_referral;

-- New constraint: at most one of is_won, is_lost, is_referral can be true at a time
ALTER TABLE pipeline_stages
  ADD CONSTRAINT pipeline_stages_single_close_type
  CHECK (
    (is_won::int + is_lost::int + is_referral::int) <= 1
  );
