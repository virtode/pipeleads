# Architecture — PipeLeads

---

## Vue d'ensemble infrastructure

```
┌─────────────────────────────────────────────────────────────────────┐
│  Internet                                                           │
│                                                                     │
│  client1.pipeleads.app  ──┐                                         │
│  client2.pipeleads.app  ──┤──► OVH DNS (wildcard *.pipeleads.app)  │
│  pipeleads.app/admin    ──┘         │                               │
└─────────────────────────────────────┼───────────────────────────────┘
                                      ▼
┌─────────────────────── VPS Hetzner (Ubuntu 22.04) ──────────────────┐
│                                                                      │
│  ┌─────────────────── Coolify (PaaS) ───────────────────────────┐   │
│  │                                                               │   │
│  │  ┌──────────────────────────────────────────────────────┐    │   │
│  │  │  Traefik (reverse proxy)                             │    │   │
│  │  │  • TLS wildcard (Let's Encrypt)                      │    │   │
│  │  │  • Route *.pipeleads.app → Next.js :3000             │    │   │
│  │  │  • Route db.pipeleads.app → Supabase Master          │    │   │
│  │  └────────────────────────┬─────────────────────────────┘    │   │
│  │                           │                                   │   │
│  │          ┌────────────────┼────────────────┐                 │   │
│  │          ▼                ▼                ▼                 │   │
│  │  ┌──────────────┐ ┌─────────────┐ ┌─────────────┐          │   │
│  │  │  Next.js     │ │  Supabase   │ │  Supabase   │          │   │
│  │  │  PipeLeads   │ │   Master    │ │  Tenant-1   │   ...    │   │
│  │  │  :3000       │ │  :5432/8000 │ │  :5433/8001 │          │   │
│  │  └──────┬───────┘ └──────┬──────┘ └──────┬──────┘          │   │
│  │         │                │               │                  │   │
│  │         │    (service     │               │                  │   │
│  │         │     role key)   │               │                  │   │
│  │         └────────────────►│               │                  │   │
│  │         │                └──────────────►│                  │   │
│  │         │                  (tenant creds  │  (anon key via   │   │
│  │         │                   in headers)   │   middleware)    │   │
│  └─────────┼──────────────────────────────────────────────────-┘   │
└────────────┼────────────────────────────────────────────────────────┘
             │
             ▼
     Navigateur utilisateur
```

---

## Couches applicatives

### 1. DNS — OVH

```
Zone DNS pipeleads.app :

pipeleads.app.       A    10.x.x.x   (IP VPS Hetzner)
*.pipeleads.app.     A    10.x.x.x   (wildcard — même IP)
```

Tout sous-domaine de `pipeleads.app` pointe vers le même VPS.
Traefik différencie les services par le header `Host`.

### 2. Traefik (Coolify built-in)

Traefik reçoit toutes les requêtes et les route selon le domaine :

| Règle Host | Destination |
|---|---|
| `pipeleads.app` | Next.js :3000 |
| `*.pipeleads.app` | Next.js :3000 (même service, slug extrait par middleware) |
| `db.pipeleads.app` | Supabase Master (API + Studio) |
| `db-client1.pipeleads.app` | Supabase Tenant-1 (si self-hosted) |

TLS : certificat wildcard `*.pipeleads.app` généré automatiquement via Let's Encrypt
(challenge DNS-01 ou HTTP-01 selon la configuration Coolify).

### 3. Next.js (App Router)

Application unique servant tous les tenants. La différenciation se fait via :

1. **middleware.ts** — intercepte chaque requête, résout le tenant, injecte les headers
2. **lib/supabase/server.ts** — lit les headers `x-tenant-*` pour créer le bon client Supabase
3. **lib/supabase/client.ts** — côté navigateur, utilise les credentials du tenant courant

```
Requête : GET client1.pipeleads.app/contacts
    │
    ▼ middleware.ts (Edge Runtime)
    ├── extractSlug("client1.pipeleads.app") → "client1"
    ├── resolveTenant("client1")
    │     └── fetch MASTER_SUPABASE_URL/rest/v1/tenants?slug=eq.client1
    │           → { id, slug, name, supabase_url, supabase_anon_key, is_active }
    ├── inject headers x-tenant-*
    ├── createServerClient(tenant.supabase_url, tenant.anon_key)
    ├── getUser() → redirect /login si pas de session
    └── NextResponse avec headers injectés
    │
    ▼ Server Component : contacts/page.tsx
    ├── createClient()  ←  lit headers x-tenant-supabase-url, x-tenant-anon-key
    └── supabase.from('contacts').select() → données du tenant
```

### 4. Supabase Master

Projet Supabase dédié **uniquement** au registre multi-tenant.

```
Tables :
┌──────────────────────────────────────────────────────────┐
│ tenants                                                  │
│  id               uuid PK                               │
│  slug             text UNIQUE  ← "client1"              │
│  name             text         ← "Acme Corp"            │
│  supabase_url     text         ← URL projet tenant      │
│  supabase_anon_key text        ← anon key projet tenant │
│  is_active        boolean      ← activer/désactiver     │
│  created_at       timestamptz                           │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ admin_users                                              │
│  id         uuid PK                                     │
│  email      text UNIQUE  ← email des super-admins       │
│  created_at timestamptz                                 │
└──────────────────────────────────────────────────────────┘
```

Accès : **service role key uniquement** — aucune RLS, accessible uniquement
depuis `lib/admin/auth.ts` et le middleware (côté serveur).

### 5. Supabase Tenant (par client)

Chaque tenant possède son propre projet Supabase isolé.

```
Tables métier :
  contacts            (CRM principal)
  pipelines           (définition des pipelines)
  pipeline_stages     (étapes de chaque pipeline)
  contact_pipeline    (association contact ↔ pipeline + étape courante)
  pipeline_history    (audit trail des changements d'étape)
  ai_enrichments      (résultats des enrichissements IA)
  notion_config       (configuration export Notion)

Table accès :
  tenant_users        (user_id, role: 'manager'|'member')
```

RLS activé sur toutes les tables — chaque utilisateur ne voit que ses propres données
(via `auth.uid()::text = user_id`).

---

## Flux d'authentification complet

### A. Connexion utilisateur tenant (OTP + Magic Link)

```
Navigateur                   Next.js              GoTrue (tenant)
    │                           │                      │
    │── POST /login (email) ───►│                      │
    │                           │── signInWithOtp ─────►│
    │                           │   shouldCreateUser:  │
    │                           │   false              │
    │                           │◄─ { error: null } ───│
    │◄── phase: 'otp' ──────────│                      │
    │                           │          ┌───────────┘
    │                           │          │ Email envoyé :
    │                           │          │ • Code 6 chiffres
    │                           │          │ • Magic link → /auth/confirm
    │                           │          └───────────────────────────────►
    │                           │                              (boîte mail)
    │                           │
    │ Option A — Code OTP        │
    │── POST verifyOtp ─────────►│
    │   { email, token, type:   │
    │     'email' }             │── verifyOtp ──────────►│
    │                           │◄─ session créée ────────│
    │◄── redirect /contacts ────│                         │
    │                           │
    │ Option B — Magic Link      │
    │── GET /auth/confirm ──────►│ (page statique, SafeLinks scanne ici)
    │◄── HTML "Confirmer" ───────│
    │                           │
    │── clic "Confirmer" ───────►│
    │                           │── verifyOtp ────────────►│
    │                           │   { token_hash, type:    │
    │                           │     'magiclink' }        │
    │                           │◄─ session créée ──────────│
    │◄── redirect /contacts ────│                           │
```

### B. Connexion administrateur backoffice

```
Navigateur (pipeleads.app/admin)    Next.js              Supabase Master
    │                                   │                      │
    │── POST /admin/login ──────────────►│                      │
    │   (email + password)              │                      │
    │                           createBrowserClient(           │
    │                           NEXT_PUBLIC_SUPABASE_URL)      │
    │                                   │── signInWithPassword ►│
    │                                   │◄─ session cookie ─────│
    │◄── redirect /admin/dashboard ─────│                       │
    │                                   │
    │── GET /admin/tenants ─────────────►│
    │                           requireAdminAuth()              │
    │                                   │── getUser() ──────────►│
    │                                   │── SELECT admin_users  ►│
    │                                   │   WHERE email = ...   │
    │                                   │◄─ { id, email } ──────│
    │◄── page admin ─────────────────────│
```

### C. Session middleware (toutes les requêtes)

```
middleware.ts (Edge Runtime)
    │
    ├── Si route admin (/admin, /api/admin) → skip résolution tenant → next()
    ├── Si /tenant-not-found → skip → next()
    │
    ├── extractSlug(host) → slug ou null
    │
    ├── Si slug :
    │   ├── fetch tenants WHERE slug = ... → TenantRow
    │   ├── Si inexistant ou is_active=false → redirect /tenant-not-found
    │   └── inject x-tenant-* headers
    │
    ├── createServerClient(tenantUrl, tenantAnonKey)
    │   └── cookies: read from request, write to response
    │
    ├── getUser()
    │   ├── Si pas de session ET route non-auth → redirect /login
    │   └── Si session valide → refreshed dans les cookies response
    │
    └── return supabaseResponse (avec cookies rafraîchis + headers tenant)
```

---

## Onboarding d'un nouveau tenant

```
Admin (pipeleads.app/admin)         Next.js API          Supabase Master    Nouveau Supabase Tenant
    │                                   │                      │                    │
    │── POST /api/admin/tenants ────────►│                      │                    │
    │   { slug, name, supabase_url,     │                      │                    │
    │     supabase_anon_key,            │                      │                    │
    │     manager_email? }              │                      │                    │
    │                                   │── INSERT tenants ─────►│                    │
    │                                   │── inviteUserByEmail ───────────────────────►│
    │                                   │   (si manager_email)                       │
    │◄── { tenant } ────────────────────│                                            │
    │                                   │                                            │
    │── POST /api/admin/tenants/        │                                            │
    │   init-schema ────────────────────►│                                            │
    │                                   │── Management API ──────────────────────────►│
    │                                   │   execute TENANT_SCHEMA_SQL                │
    │◄── { ok } ────────────────────────│                                            │
```

> **Note :** La route `/api/admin/tenants/init-schema` est référencée dans l'interface
> mais n'est pas encore implémentée (voir liste des problèmes connus).
> En attendant, appliquer le schéma manuellement via le SQL Editor de chaque projet tenant.

---

## Sécurité — points clés

| Vecteur | Mesure |
|---|---|
| Isolation données | Chaque tenant = projet Supabase distinct (isolation physique) |
| RLS | Activé sur toutes les tables tenant — `user_id = auth.uid()::text` |
| Service role keys | Jamais exposées côté client — uniquement Route Handlers et Server Components |
| Admin backoffice | Double vérification : session valide **ET** email dans `admin_users` |
| Inscriptions | `GOTRUE_DISABLE_SIGNUP=true` sur les tenants — comptes par invitation uniquement |
| Magic link SafeLinks | Page intermédiaire `/auth/confirm` — token consommé uniquement sur clic utilisateur |
| Headers tenant | `x-tenant-anon-key` transmis au navigateur uniquement (clé publique) — jamais la service role key |

---

## Décisions d'architecture notables

**Pourquoi un Supabase par tenant et non RLS multi-tenant ?**
L'isolation physique garantit qu'aucune fuite de données entre tenants n'est possible,
même en cas de bug de politique RLS. Chaque client contrôle son propre projet,
ses propres backups, et peut exporter ses données indépendamment.

**Pourquoi le middleware résout le tenant à chaque requête ?**
Le middleware tourne en Edge Runtime (pas de cache persistent disponible).
Une requête vers le master Supabase est faite à chaque appel.
Pour les projets à fort trafic, envisager un cache KV (ex: Upstash Redis) pour
les credentials tenant avec une TTL de ~60 secondes.

**Pourquoi `x-tenant-anon-key` dans les headers et non une variable d'env ?**
Un seul déploiement Next.js sert N tenants différents. Les variables d'environnement
sont statiques au démarrage — seuls les headers permettent de transporter dynamiquement
les credentials du bon projet tenant dans chaque requête.
