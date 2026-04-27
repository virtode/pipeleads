-- Global AI config (super admin)
CREATE TABLE IF NOT EXISTS ai_config_global (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider         text NOT NULL DEFAULT 'anthropic',
  model            text NOT NULL DEFAULT 'anthropic/claude-sonnet-4-6',
  budget_usd       numeric(10,2),
  alert_threshold  int NOT NULL DEFAULT 80,
  fallback_provider text,
  fallback_model   text,
  allowed_providers text[] NOT NULL DEFAULT '{anthropic}',
  allow_byok       boolean NOT NULL DEFAULT true,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid REFERENCES auth.users(id)
);

-- Seed default row
INSERT INTO ai_config_global (id)
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Per-tenant AI config override
CREATE TABLE IF NOT EXISTS ai_config_tenant (
  tenant_id        text PRIMARY KEY,
  use_global       boolean NOT NULL DEFAULT true,
  provider         text,
  model            text,
  encrypted_api_key text,
  budget_usd       numeric(10,2),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid REFERENCES auth.users(id)
);

-- RLS
ALTER TABLE ai_config_global ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_config_tenant ENABLE ROW LEVEL SECURITY;

-- ai_config_global: only service_role can read/write
CREATE POLICY "service_role_only_global" ON ai_config_global
  USING (auth.role() = 'service_role');

-- ai_config_tenant: service_role full access
CREATE POLICY "service_role_only_tenant" ON ai_config_tenant
  USING (auth.role() = 'service_role');
