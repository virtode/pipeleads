# PipeLeads — Guide d'installation

Application personnelle de gestion de contacts et de leads.
Ce guide permet de déployer une instance from scratch en ~30 minutes.

---

## Prérequis

- Node.js 20+
- Un compte [Supabase](https://supabase.com) (plan Free suffisant)
- Un compte [Vercel](https://vercel.com) (plan Hobby suffisant)
- Un compte [Anthropic](https://console.anthropic.com) (optionnel — pour l'agent IA)
- Un compte [Notion](https://notion.so) (optionnel — pour la sync Notion)

---

## Étape 1 — Cloner le dépôt

```bash
git clone https://github.com/mateyk/pipeleads.git
cd pipeleads
npm install
```

---

## Étape 2 — Créer le projet Supabase

1. Va sur [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. Choisis une région proche de toi
3. Note le **mot de passe de la base** (tu en auras besoin si tu utilises le CLI)
4. Attends que le projet soit prêt (~2 min)

---

## Étape 3 — Initialiser la base de données

Va dans ton projet Supabase → **SQL Editor** → **New query**.
Colle le script complet ci-dessous et clique **Run**.

```sql
-- ============================================================
-- PipeLeads — Schéma complet (installation from scratch)
-- À exécuter en une seule fois dans l'éditeur SQL Supabase
-- ============================================================


-- ------------------------------------------------------------
-- 1. FONCTION TRIGGER updated_at
-- ------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ------------------------------------------------------------
-- 2. TABLES
-- Note : user_id est de type text pour stocker les UUID Supabase Auth
-- ------------------------------------------------------------

-- Contacts
create table public.contacts (
  id           uuid        primary key default gen_random_uuid(),
  user_id      text        not null,
  first_name   text        not null,
  last_name    text,
  email        text[],
  phone        text[],
  company      text,
  job_title    text,
  address      text,
  city         text,
  country      text,
  tags         text[],
  notes        text,
  photo_url    text,
  linkedin_url text,
  twitter_url  text,
  website      text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Pipelines
create table public.pipelines (
  id          uuid        primary key default gen_random_uuid(),
  user_id     text        not null,
  name        text        not null,
  description text,
  created_at  timestamptz not null default now()
);

-- Étapes d'un pipeline
create table public.pipeline_stages (
  id          uuid        primary key default gen_random_uuid(),
  pipeline_id uuid        not null references public.pipelines on delete cascade,
  name        text        not null,
  color       text        not null default '#6366f1',
  position    integer     not null,
  created_at  timestamptz not null default now(),
  unique(pipeline_id, position)
);

-- Association contact <-> pipeline avec étape courante
create table public.contact_pipeline (
  id          uuid        primary key default gen_random_uuid(),
  contact_id  uuid        not null references public.contacts on delete cascade,
  pipeline_id uuid        not null references public.pipelines on delete cascade,
  stage_id    uuid        references public.pipeline_stages on delete set null,
  value       numeric,
  updated_at  timestamptz not null default now(),
  unique(contact_id, pipeline_id)
);

-- Historique des changements d'étape
create table public.pipeline_history (
  id            uuid        primary key default gen_random_uuid(),
  contact_id    uuid        not null references public.contacts on delete cascade,
  pipeline_id   uuid        not null references public.pipelines on delete cascade,
  from_stage_id uuid        references public.pipeline_stages on delete set null,
  to_stage_id   uuid        references public.pipeline_stages on delete set null,
  changed_at    timestamptz not null default now()
);

-- Enrichissements IA
create table public.ai_enrichments (
  id         uuid        primary key default gen_random_uuid(),
  contact_id uuid        not null references public.contacts on delete cascade,
  type       text        not null check (type in ('contact_profile', 'company_news')),
  content    text        not null,
  model      text,
  created_at timestamptz not null default now()
);

-- Configuration Notion (token stocké chiffré AES-256-GCM)
create table public.notion_config (
  id              uuid        primary key default gen_random_uuid(),
  user_id         text        not null unique,
  database_id     text        not null,
  encrypted_token text,
  field_mapping   jsonb       not null default '{}',
  last_sync_at    timestamptz,
  created_at      timestamptz not null default now()
);


-- ------------------------------------------------------------
-- 3. TRIGGERS updated_at
-- ------------------------------------------------------------

create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

create trigger contact_pipeline_set_updated_at
  before update on public.contact_pipeline
  for each row execute function public.set_updated_at();


-- ------------------------------------------------------------
-- 4. INDEX DE PERFORMANCE
-- ------------------------------------------------------------

create index idx_contacts_user_id
  on public.contacts (user_id);

create index idx_contacts_company
  on public.contacts (user_id, company)
  where company is not null;

create index idx_contacts_tags
  on public.contacts using gin (tags)
  where tags is not null;

create index idx_contacts_created_at
  on public.contacts (user_id, created_at desc);

create index idx_pipelines_user_id
  on public.pipelines (user_id);

create index idx_pipeline_stages_pipeline_position
  on public.pipeline_stages (pipeline_id, position);

create index idx_contact_pipeline_contact_id
  on public.contact_pipeline (contact_id);

create index idx_contact_pipeline_pipeline_stage
  on public.contact_pipeline (pipeline_id, stage_id);

create index idx_pipeline_history_contact_id
  on public.pipeline_history (contact_id, changed_at desc);

create index idx_pipeline_history_pipeline_id
  on public.pipeline_history (pipeline_id, changed_at desc);

create index idx_ai_enrichments_contact_created
  on public.ai_enrichments (contact_id, created_at desc);


-- ------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
-- auth.uid() retourne un UUID — on le caste en text pour correspondre
-- au type de la colonne user_id
-- ------------------------------------------------------------

alter table public.contacts         enable row level security;
alter table public.pipelines        enable row level security;
alter table public.pipeline_stages  enable row level security;
alter table public.contact_pipeline enable row level security;
alter table public.pipeline_history enable row level security;
alter table public.ai_enrichments   enable row level security;
alter table public.notion_config    enable row level security;

create policy "own data" on public.contacts
  for all using (auth.uid()::text = user_id);

create policy "own data" on public.pipelines
  for all using (auth.uid()::text = user_id);

create policy "own stages" on public.pipeline_stages
  for all using (
    pipeline_id in (
      select id from public.pipelines where auth.uid()::text = user_id
    )
  );

create policy "own data" on public.contact_pipeline
  for all using (
    contact_id in (
      select id from public.contacts where auth.uid()::text = user_id
    )
  );

create policy "own data" on public.pipeline_history
  for all using (
    contact_id in (
      select id from public.contacts where auth.uid()::text = user_id
    )
  );

create policy "own data" on public.ai_enrichments
  for all using (
    contact_id in (
      select id from public.contacts where auth.uid()::text = user_id
    )
  );

create policy "own data" on public.notion_config
  for all using (auth.uid()::text = user_id);
```

---

## Étape 4 — Configurer l'authentification Supabase

Dans ton projet Supabase → **Authentication** :

### 4a. Activer le provider Email (Magic Link)

1. **Authentication → Sign In / Up → Email** → vérifier que c'est activé
2. Désactiver **"Confirm email"** → activer **"Secure email change"** (optionnel)
3. Dans **Authentication → Sign In / Up** : activer **"Disable sign ups"** pour empêcher
   toute inscription non autorisée (usage solo)

### 4b. Configurer les URLs de redirection

**Authentication → URL Configuration** :

| Champ | Valeur dev | Valeur prod |
|---|---|---|
| Site URL | `http://localhost:3000` | `https://ton-domaine.vercel.app` |
| Redirect URLs | `http://localhost:3000/auth/callback` | `https://ton-domaine.vercel.app/auth/callback` |

### 4c. Créer ton compte utilisateur

Supabase Auth ne crée pas de comptes automatiquement (c'est voulu).
Crée-toi manuellement via l'API admin avec ta **Service Role Key** :

```bash
curl -X POST \
  "https://<PROJECT_REF>.supabase.co/auth/v1/admin/users" \
  -H "Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>" \
  -H "apikey: <SUPABASE_SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ton@email.com",
    "email_confirm": true
  }'
```

Remplace `<PROJECT_REF>` par ta ref projet (visible dans l'URL du dashboard)
et `<SUPABASE_SERVICE_ROLE_KEY>` par ta clé (voir Étape 5).

---

## Étape 5 — Variables d'environnement

### Où trouver chaque variable

#### Supabase — projet → Settings → API

| Variable | Type | Description | Où la trouver |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | publique | URL de ton projet Supabase | Settings → API → **Project URL** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publique | Clé anonyme (lecture publique limitée par RLS) | Settings → API → **anon / public** |
| `SUPABASE_SERVICE_ROLE_KEY` | **secrète** | Clé admin (bypass RLS) — utilisée aussi pour chiffrer les tokens Notion | Settings → API → **service_role** |

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` ne doit **jamais** être exposée côté client.
> Elle est utilisée dans les Route Handlers uniquement ET sert de clé de
> dérivation AES-256-GCM pour chiffrer le token Notion en base.
> **Si tu changes cette clé, les tokens Notion chiffrés en base seront illisibles.**

#### Anthropic — console.anthropic.com → API Keys

| Variable | Type | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | **secrète** | Clé API pour l'agent d'enrichissement IA (Claude) |

> Optionnel : si absent, la page IA s'affiche mais les requêtes d'enrichissement échouent.

#### Notion — optionnel, configuré dans l'interface

Le token Notion (`secret_...`) est saisi directement dans **Paramètres → Intégration Notion**
de l'application et stocké chiffré en base. Il n'y a pas de variable d'environnement Notion
à configurer côté serveur.

---

### Variables hardcodées à surveiller

Deux valeurs sont hardcodées dans le code source et pourraient être externalisées
si tu veux les changer sans redéployer :

| Valeur | Fichier | Ligne | Recommandation |
|---|---|---|---|
| `'claude-sonnet-4-6'` | `lib/ai/agent.ts` | `const MODEL = 'claude-sonnet-4-6'` | Ajouter `ANTHROPIC_MODEL` si tu veux utiliser un autre modèle |
| `'claude-sonnet-4-6'` | `app/api/ai/enrich/route.ts` | `anthropic('claude-sonnet-4-6')` | Idem |

---

### Fichier `.env.local` (développement local)

Crée ce fichier à la racine du projet :

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>

# Anthropic (optionnel)
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Étape 6 — Déployer sur Vercel

### 6a. Importer le projet

1. [vercel.com/new](https://vercel.com/new) → **Import Git Repository**
2. Sélectionne ton fork de `pipeleads`
3. Framework : **Next.js** (détecté automatiquement)

### 6b. Ajouter les variables d'environnement

Dans Vercel → **Settings → Environment Variables**, ajoute :

| Variable | Environnements |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | Production, Preview, Development |
| `ANTHROPIC_API_KEY` | Production (et Preview si voulu) |

### 6c. Mettre à jour l'URL Supabase

Une fois ton domaine Vercel connu (ex: `pipeleads-xxx.vercel.app`), retourne dans
**Supabase → Authentication → URL Configuration** et ajoute :
- `https://pipeleads-xxx.vercel.app/auth/callback` dans les Redirect URLs

### 6d. Déployer

Clique **Deploy**. Le premier déploiement prend ~2 min.

---

## Étape 7 — Tester le flux complet

1. Ouvre `https://ton-domaine.vercel.app`
2. Tu es redirigé vers `/login`
3. Saisis ton email → **Recevoir un lien de connexion**
4. Clique le lien dans ta boîte mail
5. Tu es redirigé vers `/contacts` ✅

---

## Récapitulatif des variables requises

| Variable | Requise | Publique | Source |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ❌ | Supabase → Settings → API |
| `ANTHROPIC_API_KEY` | Optionnel | ❌ | console.anthropic.com |

---

## Dépannage

**"Adresse email non reconnue"** → Ton email n'existe pas encore dans Supabase Auth.
Exécute la commande curl de l'Étape 4c.

**Redirect loop sur `/login`** → Vérifie que `NEXT_PUBLIC_SUPABASE_URL` et
`NEXT_PUBLIC_SUPABASE_ANON_KEY` sont correctement renseignés dans Vercel.

**Magic Link redirige vers une mauvaise URL** → Vérifie que l'URL de production est
dans les Redirect URLs Supabase (Étape 4b).

**Erreur 500 sur `/api/ai/enrich`** → Vérifie que `ANTHROPIC_API_KEY` est renseignée
dans Vercel et que tu as du crédit Anthropic disponible.

**Les tokens Notion sont illisibles après changement de `SUPABASE_SERVICE_ROLE_KEY`** →
Le chiffrement AES-256-GCM est dérivé de cette clé. En cas de rotation, reconnecte
Notion depuis **Paramètres → Intégration Notion** pour re-chiffrer avec la nouvelle clé.
