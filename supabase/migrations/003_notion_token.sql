-- Migration 003 : add encrypted_token column to notion_config
-- The integration token is stored AES-256-GCM encrypted — never in clear text.

alter table notion_config
  add column if not exists encrypted_token text;
