-- Add is_referral column to pipeline_stages
ALTER TABLE pipeline_stages
  ADD COLUMN IF NOT EXISTS is_referral BOOLEAN NOT NULL DEFAULT false;

-- Business constraint: a stage cannot be both is_lost and is_referral at the same time
ALTER TABLE pipeline_stages
  ADD CONSTRAINT pipeline_stages_not_lost_and_referral
  CHECK (NOT (is_lost = true AND is_referral = true));
