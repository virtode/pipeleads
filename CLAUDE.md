# CLAUDE.md — PipeLeads

Ce fichier définit les règles de développement pour PipeLeads.
Lis-le entièrement avant d'écrire la moindre ligne de code.

---

## Contexte du projet

Application web **personnelle** de gestion de contacts et de leads.
Usage solo (un seul utilisateur). Pas de gestion d'équipes, pas de multi-tenant.

---

## Stack — versions exactes

| Rôle | Package | Version |
|---|---|---|
| Framework | next | 15.x (App Router) |
| Langage | typescript | 5.x |
| Styling | tailwindcss | 3.x |
| Composants UI | shadcn/ui | latest |
| Icônes | lucide-react | latest |
| BDD / Backend | @supabase/supabase-js | 2.x |
| Auth | @stytch/nextjs | latest |
| Tables | @tanstack/react-table | 8.x |
| Cache serveur | @tanstack/react-query | 5.x |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable | latest |
| Formulaires | react-hook-form | 7.x |
| Validation | zod | 3.x |
| Graphiques | recharts | 2.x |
| Agent IA | @anthropic-ai/sdk | latest |
| Notion | @notionhq/client | latest |

---

## Structure de dossiers

```
/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── callback/
│   ├── (app)/
│   │   ├── layout.tsx          # Layout principal avec sidebar
│   │   ├── contacts/
│   │   │   ├── page.tsx        # Liste contacts
│   │   │   └── [id]/
│   │   │       └── page.tsx    # Fiche contact
│   │   ├── leads/
│   │   │   └── page.tsx        # Vue Kanban
│   │   ├── pipelines/
│   │   │   └── page.tsx        # Gestion des pipelines
│   │   ├── reports/
│   │   │   └── page.tsx        # Rapports & analytics
│   │   └── settings/
│   │       └── page.tsx        # Paramètres (Notion, etc.)
│   ├── api/
│   │   ├── ai/
│   │   │   └── enrich/
│   │   │       └── route.ts    # Agent IA
│   │   └── notion/
│   │       └── sync/
│   │           └── route.ts    # Sync Notion
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                     # shadcn/ui components (auto-générés)
│   ├── contacts/               # Composants spécifiques contacts
│   ├── pipeline/               # Composants Kanban et pipeline
│   ├── reports/                # Composants graphiques
│   └── shared/                 # Composants partagés (layout, nav, etc.)
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # Client Supabase côté browser
│   │   ├── server.ts           # Client Supabase côté server
│   │   └── types.ts            # Types générés depuis le schéma
│   ├── stytch/
│   │   └── client.ts           # Config Stytch
│   ├── ai/
│   │   └── agent.ts            # Logique agent IA
│   ├── notion/
│   │   └── sync.ts             # Logique sync Notion
│   └── utils.ts                # Helpers généraux
├── hooks/                      # Custom React hooks
├── types/                      # Types TypeScript globaux
├── supabase/
│   └── migrations/             # Fichiers SQL de migration
├── .env.local                  # Variables d'environnement (ne jamais committer)
├── .env.example                # Template des variables
└── CLAUDE.md                   # Ce fichier
```

---

## Variables d'environnement requises

Crée un fichier `.env.local` avec ces variables. Ne les expose JAMAIS côté client (pas de NEXT_PUBLIC_ pour les secrets).

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stytch
NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN=
STYTCH_PROJECT_ID=
STYTCH_SECRET=

# Anthropic (agent IA)
ANTHROPIC_API_KEY=

# Notion
NOTION_INTEGRATION_TOKEN=
```

Crée aussi un `.env.example` avec les mêmes clés mais sans valeurs.

---

## Conventions de code

### TypeScript
- Strict mode activé (`strict: true` dans tsconfig)
- Pas de `any` — utilise `unknown` si le type est incertain
- Tous les composants ont leurs props typées avec une interface nommée `XxxProps`
- Les fonctions async retournent toujours un type explicite

### Composants React
- Functional components uniquement, pas de class components
- Un composant par fichier
- Nommage : PascalCase pour les composants, camelCase pour les fonctions/hooks
- Les Server Components sont la règle par défaut ; ajoute `'use client'` uniquement si nécessaire (event handlers, hooks)
- Les hooks custom commencent par `use` et vivent dans `/hooks`

### Supabase
- Utilise `lib/supabase/server.ts` dans les Server Components et API Routes
- Utilise `lib/supabase/client.ts` dans les Client Components
- Toutes les queries passent par TanStack Query côté client
- Le Row Level Security (RLS) est activé sur toutes les tables — ne jamais utiliser la service role key côté client

### Formulaires
- React Hook Form + Zod pour tous les formulaires
- Le schéma Zod est défini dans le même fichier que le formulaire
- Les messages d'erreur sont en français

### Styling
- Tailwind CSS uniquement — pas de fichiers CSS séparés (sauf globals.css)
- Utilise les composants shadcn/ui en priorité avant d'en créer de nouveaux
- Thème : clair par défaut, support du mode sombre via la classe `dark`
- Responsive : mobile-first (`sm:`, `md:`, `lg:`)

### API Routes (Next.js)
- Toutes les routes API vérifient la session Stytch avant de traiter la requête
- Retournent toujours `{ data, error }` avec les codes HTTP appropriés
- Les erreurs sont loggées côté serveur, jamais exposées en détail côté client

---

## Ce qu'il ne faut PAS faire

- ❌ Ne pas utiliser Redux ou Zustand — TanStack Query gère l'état serveur, useState/useReducer pour l'état local
- ❌ Ne pas créer de fichiers CSS séparés
- ❌ Ne pas utiliser `fetch` directement dans les composants — passe par TanStack Query
- ❌ Ne pas exposer `SUPABASE_SERVICE_ROLE_KEY` ou `ANTHROPIC_API_KEY` côté client
- ❌ Ne pas utiliser `pages/` router — on utilise exclusivement `app/` router
- ❌ Ne pas installer de librairies supplémentaires sans le mentionner explicitement
- ❌ Ne pas gérer plusieurs utilisateurs — c'est un outil solo

---

## Schéma de base de données

Les migrations SQL sont dans `supabase/migrations/`. Voici le schéma cible :

```sql
-- Contacts
create table contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  first_name text not null,
  last_name text,
  email text[],
  phone text[],
  company text,
  job_title text,
  address text,
  city text,
  country text,
  tags text[],
  notes text,
  photo_url text,
  linkedin_url text,
  twitter_url text,
  website text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Pipelines
create table pipelines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  description text,
  created_at timestamptz default now()
);

-- Étapes d'un pipeline
create table pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid references pipelines on delete cascade not null,
  name text not null,
  color text default '#6366f1',
  position integer not null,
  created_at timestamptz default now()
);

-- Association contact <-> pipeline avec statut courant
create table contact_pipeline (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts on delete cascade not null,
  pipeline_id uuid references pipelines on delete cascade not null,
  stage_id uuid references pipeline_stages on delete set null,
  value numeric,
  updated_at timestamptz default now(),
  unique(contact_id, pipeline_id)
);

-- Historique des changements de statut
create table pipeline_history (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts on delete cascade not null,
  pipeline_id uuid references pipelines on delete cascade not null,
  from_stage_id uuid references pipeline_stages on delete set null,
  to_stage_id uuid references pipeline_stages on delete set null,
  changed_at timestamptz default now()
);

-- Enrichissements IA
create table ai_enrichments (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts on delete cascade not null,
  type text not null, -- 'contact_profile' | 'company_news'
  content text not null,
  model text,
  created_at timestamptz default now()
);

-- Paramètres Notion
create table notion_config (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null unique,
  database_id text not null,
  field_mapping jsonb not null default '{}',
  last_sync_at timestamptz,
  created_at timestamptz default now()
);

-- RLS : chaque utilisateur ne voit que ses données
alter table contacts enable row level security;
alter table pipelines enable row level security;
alter table pipeline_stages enable row level security;
alter table contact_pipeline enable row level security;
alter table pipeline_history enable row level security;
alter table ai_enrichments enable row level security;
alter table notion_config enable row level security;

create policy "own data" on contacts for all using (auth.uid() = user_id);
create policy "own data" on pipelines for all using (auth.uid() = user_id);
create policy "own stages" on pipeline_stages for all using (
  pipeline_id in (select id from pipelines where user_id = auth.uid())
);
create policy "own data" on contact_pipeline for all using (
  contact_id in (select id from contacts where user_id = auth.uid())
);
create policy "own data" on pipeline_history for all using (
  contact_id in (select id from contacts where user_id = auth.uid())
);
create policy "own data" on ai_enrichments for all using (
  contact_id in (select id from contacts where user_id = auth.uid())
);
create policy "own data" on notion_config for all using (auth.uid() = user_id);
```

---

## Fonctionnalités — rappel rapide

| Module | Détail |
|---|---|
| Contacts | CRUD complet, recherche, filtres, tags, photo |
| Import | CSV (avec mapping colonnes) + VCF (vCard 2.1/3.0/4.0) |
| Export | CSV (sélection colonnes) + VCF (contact unique ou sélection) |
| Pipelines | Statuts ordonnés par glisser-déposer, couleur par étape |
| Kanban | Vue par pipeline, cartes déplaçables entre colonnes |
| Rapports | Distribution par statut, évolution temporelle, taux de conversion |
| Agent IA | Recherche web sur entreprise et contact via API Anthropic |
| Notion | Export unidirectionnel CRM → Notion (tableau de suivi) |
| Auth | Stytch Magic Link + OAuth Google — accès libre, usage solo |
