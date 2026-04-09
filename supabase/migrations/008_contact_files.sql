-- ════════════════════════════════════════════════════════════
-- 008 — Pièces jointes sur les contacts (contact_files)
-- ════════════════════════════════════════════════════════════

-- Table de métadonnées des fichiers liés aux contacts
create table if not exists public.contact_files (
  id          uuid        primary key default gen_random_uuid(),
  contact_id  uuid        not null references public.contacts(id) on delete cascade,
  name        text        not null,
  file_name   text        not null,
  file_path   text        not null,
  file_size   integer,
  mime_type   text,
  description text,
  uploaded_by text,
  created_at  timestamptz not null default now()
);

-- Index de performance
create index if not exists idx_contact_files_contact_id
  on public.contact_files (contact_id);

-- RLS
alter table public.contact_files enable row level security;

-- Policies idempotentes
drop policy if exists "Users can view files of their contacts"   on public.contact_files;
drop policy if exists "Users can insert files on their contacts" on public.contact_files;
drop policy if exists "Users can delete files of their contacts" on public.contact_files;

create policy "Users can view files of their contacts"
  on public.contact_files for select
  using (
    exists (
      select 1 from public.contacts
      where public.contacts.id = public.contact_files.contact_id
        and public.contacts.user_id = auth.uid()::text
    )
  );

create policy "Users can insert files on their contacts"
  on public.contact_files for insert
  with check (
    exists (
      select 1 from public.contacts
      where public.contacts.id = public.contact_files.contact_id
        and public.contacts.user_id = auth.uid()::text
    )
  );

create policy "Users can delete files of their contacts"
  on public.contact_files for delete
  using (
    exists (
      select 1 from public.contacts
      where public.contacts.id = public.contact_files.contact_id
        and public.contacts.user_id = auth.uid()::text
    )
  );
