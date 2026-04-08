# PipeLeads

Application web multi-tenant de gestion de contacts et de leads.
Un seul déploiement Next.js sert N clients via des sous-domaines (`client.pipeleads.app`),
chacun avec son propre projet Supabase isolé.

---

## Table des matières

- [Architecture](#architecture)
- [Prérequis](#prérequis)
- [Variables d'environnement](#variables-denvironnement)
- [Installation step-by-step](#installation-step-by-step)
- [Multi-tenant — comment ça marche](#multi-tenant--comment-ça-marche)
- [Flux d'authentification](#flux-dauthentification)
- [Commandes de développement](#commandes-de-développement)
- [Dépannage](#dépannage)

---

## Architecture

```
Internet
    │
    ▼
OVH DNS  *.pipeleads.app → 10.x.x.x (IP VPS Hetzner)
    │
    ▼
VPS Hetzner (Ubuntu)
  └── Coolify
        ├── Traefik  ← reverse proxy, wildcard TLS
        │
        ├── Next.js (PipeLeads app)
        │     middleware.ts — résolution tenant par sous-domaine
        │
        ├── Supabase Master
        │     tables : tenants, admin_users
        │     accès  : service role key uniquement
        │
        ├── Supabase Tenant-1  (client1.pipeleads.app)
        │     tables : contacts, pipelines, tenant_users, …
        │
        └── Supabase Tenant-N  (clientN.pipeleads.app)
```

### Projets Supabase

| Instance | Rôle | Accès |
|---|---|---|
| **Master** | Registre des tenants (`tenants`) et administrateurs (`admin_users`) | `MASTER_SUPABASE_URL` + `MASTER_SUPABASE_SERVICE_KEY` |
| **Par tenant** | Données métier isolées + table `tenant_users` (rôles manager/member) | Credentials stockés dans `tenants.supabase_url` / `tenants.supabase_anon_key` |

### Routing wildcard

Traefik reçoit `*.pipeleads.app` et route tout vers le même container Next.js.
Le middleware Next.js (`middleware.ts`) lit le header `host`, extrait le slug,
interroge le master Supabase, et injecte les credentials du bon projet tenant
via des headers `x-tenant-*` pour le reste de la requête.

---

## Prérequis

| Composant | Version / Remarque |
|---|---|
| Node.js | 20+ |
| VPS | Hetzner CX22 minimum (2 vCPU, 4 GB RAM) |
| Coolify | v4+ (auto-installé sur le VPS) |
| Supabase | Self-hosted via Coolify (une instance = un projet) |
| DNS | OVH ou autre — wildcard `*.pipeleads.app` + `pipeleads.app` → IP VPS |
| TLS | Géré automatiquement par Traefik (Let's Encrypt) dans Coolify |

---

## Variables d'environnement

Copier `.env.example` → `.env.local` pour le dev local.
En production, les renseigner dans Coolify (Settings → Environment Variables).

### Application Next.js

| Variable | Publique | Obligatoire | Description |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ | URL du Supabase **master** (utilisé comme fallback pour l'admin et le dev local) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ | Anon key du Supabase **master** |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ | ✅ | Service role key du Supabase **master** — bypass RLS, serveur uniquement |
| `MASTER_SUPABASE_URL` | ❌ | ✅ | URL interne du Supabase master — utilisée par le middleware et les routes admin |
| `MASTER_SUPABASE_SERVICE_KEY` | ❌ | ✅ | Service role key du master — pour résoudre les tenants et gérer `admin_users` |
| `SUPABASE_MANAGEMENT_API_KEY` | ❌ | ✅ | Personal Access Token Supabase — pour initialiser le schéma SQL d'un nouveau tenant |
| `NEXT_PUBLIC_ROOT_DOMAIN` | ✅ | ✅ | Domaine racine (`pipeleads.app`) — extrait le slug depuis le sous-domaine |
| `ANTHROPIC_API_KEY` | ❌ | Non | Clé API Claude — pour l'enrichissement IA des contacts |
| `NOTION_INTEGRATION_TOKEN` | ❌ | Non | Token d'intégration Notion — pour l'export CRM → Notion |

> Variables `NEXT_PUBLIC_STYTCH_*` présentes dans `.env.example` : **non utilisées**,
> conservées pour compatibilité ascendante. L'auth est gérée par Supabase Auth (OTP email).

### Supabase self-hosted (GoTrue) — par instance

Ces variables sont à configurer dans chaque instance Supabase self-hosted
(master et chaque tenant) via Coolify ou le fichier `docker-compose.yml` Supabase.

| Variable GoTrue | Description | Valeur recommandée |
|---|---|---|
| `GOTRUE_SITE_URL` | URL publique du site — utilisée comme base pour les liens dans les emails | `https://pipeleads.app` (master) ou `https://client.pipeleads.app` (tenant) |
| `GOTRUE_URI_ALLOW_LIST` | URLs de redirection autorisées après auth | `https://*.pipeleads.app/**,http://localhost:3000/**` |
| `GOTRUE_MAILER_AUTOCONFIRM` | Auto-confirmer les nouveaux comptes | `false` |
| `GOTRUE_DISABLE_SIGNUP` | Empêcher toute inscription non invitée | `true` (pour les tenants) |
| `GOTRUE_SMTP_HOST` | Serveur SMTP pour les emails | ex: `smtp.sendgrid.net` |
| `GOTRUE_SMTP_PORT` | Port SMTP | `587` |
| `GOTRUE_SMTP_USER` | Login SMTP | — |
| `GOTRUE_SMTP_PASS` | Mot de passe SMTP | — |
| `GOTRUE_SMTP_SENDER_NAME` | Nom de l'expéditeur | `PipeLeads` |
| `GOTRUE_MAILER_SENDER` | Email expéditeur | `noreply@pipeleads.app` |

**Template email Magic Link** à configurer dans chaque instance Supabase
(Authentication → Email Templates → Magic Link) :

```html
<a href="https://{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink">
  Confirmer ma connexion
</a>
```

Ce template pointe vers `/auth/confirm` (page intermédiaire) plutôt que directement
vers GoTrue — nécessaire pour contourner le pré-fetch Microsoft SafeLinks.

---

## Installation step-by-step

### 1. Provisionner le VPS et installer Coolify

```bash
# Sur le VPS Hetzner (Ubuntu 22.04 LTS recommandé)
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Accéder à Coolify sur `http://VPS_IP:8000` → créer le compte admin.

### 2. Configurer le DNS sur OVH

Dans le gestionnaire de zones OVH pour `pipeleads.app` :

```
A     pipeleads.app           → VPS_IP
A     *.pipeleads.app         → VPS_IP
```

Attendre la propagation DNS (~15 min à quelques heures).

### 3. Créer l'instance Supabase Master dans Coolify

1. Coolify → New Service → Supabase (template)
2. Nommer l'instance `pipeleads-master`
3. Configurer le domaine : `db.pipeleads.app` (ou tout sous-domaine réservé)
4. Lancer et attendre que l'instance soit `Running`
5. Récupérer les credentials depuis Coolify → Service → Environment Variables :
   - `SUPABASE_URL` → valeur de `MASTER_SUPABASE_URL`
   - `ANON_KEY` → valeur de `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SERVICE_ROLE_KEY` → valeur de `MASTER_SUPABASE_SERVICE_KEY`

### 4. Initialiser le schéma master

Dans le SQL Editor du Supabase master :

```sql
-- Table des tenants
create table public.tenants (
  id               uuid    primary key default gen_random_uuid(),
  slug             text    not null unique,
  name             text    not null,
  supabase_url     text    not null,
  supabase_anon_key text   not null,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

-- Table des administrateurs du backoffice
create table public.admin_users (
  id         uuid  primary key default gen_random_uuid(),
  email      text  not null unique,
  created_at timestamptz not null default now()
);

-- Pas de RLS sur ces tables — accès via service role uniquement
```

Puis ajouter le premier admin :

```sql
insert into public.admin_users (email) values ('toi@exemple.com');
```

Créer le compte auth dans Supabase master → Authentication → Users → Add user
(même email que dans `admin_users`).

### 5. Déployer l'application Next.js dans Coolify

1. Coolify → New Application → From Git
2. Connecter le dépôt GitHub
3. Build Command : `npm run build`
4. Start Command : `node .next/standalone/server.js` (ou `npm start`)
5. Domaine : `pipeleads.app` + activer wildcard dans Traefik
6. Renseigner toutes les variables d'environnement (voir section précédente)

### 6. Obtenir un Personal Access Token Supabase (Management API)

Pour initialiser le schéma SQL des nouveaux tenants automatiquement :

1. [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens)
2. Générer un token → copier dans `SUPABASE_MANAGEMENT_API_KEY`

> Si tu utilises du Supabase **self-hosted**, l'API de management n'est pas disponible.
> Le schéma tenant doit être initialisé manuellement via le SQL Editor de chaque instance.

### 7. Créer le premier tenant

1. Accéder à `https://pipeleads.app/admin` → se connecter avec l'email admin
2. Tenants → Nouveau client
3. Remplir slug, nom, credentials Supabase du projet tenant
4. Soumettre → le manager reçoit une invitation par email

---

## Multi-tenant — comment ça marche

### Résolution du tenant (middleware.ts)

```
GET client1.pipeleads.app/contacts
    │
    ▼ middleware.ts
    1. host = "client1.pipeleads.app"
    2. slug = "client1"  (extrait depuis ROOT_DOMAIN)
    3. fetch master Supabase → SELECT * FROM tenants WHERE slug = 'client1'
    4. tenant.is_active = false → redirect /tenant-not-found
    5. tenant valide → inject headers :
         x-tenant-id            = tenant.id
         x-tenant-slug          = "client1"
         x-tenant-name          = "Acme Corp"
         x-tenant-supabase-url  = "https://xyz.supabase.co"
         x-tenant-anon-key      = "eyJ..."
    6. createServerClient(tenant.supabase_url, tenant.anon_key)
    7. getUser() → pas de session → redirect /login
```

### Sous-domaines réservés

`www`, `app`, `api`, `dev`, `admin`, `staging` — jamais interprétés comme slugs tenant.
Toutes les routes `/admin` et `/api/admin` court-circuitent la résolution tenant.

### Isolation des données

Chaque tenant a son propre projet Supabase. Il n'y a **aucune donnée partagée**
entre tenants — l'isolation est physique (projets distincts), pas seulement par RLS.

### Rôles dans un tenant

| Rôle | Permissions |
|---|---|
| `manager` | CRUD complet + gestion de l'équipe (invitations, changements de rôle, révocations) |
| `member` | Lecture/écriture CRM — pas d'accès à la gestion d'équipe |

---

## Flux d'authentification

### Utilisateurs tenant (OTP email)

```
1. Utilisateur → client.pipeleads.app/login
2. Saisit son email → supabase.auth.signInWithOtp({ shouldCreateUser: false })
3. GoTrue envoie un email avec code 6 chiffres ET magic link
4. Option A — code OTP :
     Utilisateur saisit le code → verifyOtp({ type: 'email' }) → session créée
5. Option B — magic link (bypass SafeLinks) :
     Email contient un lien vers /auth/confirm?token_hash=...&type=magiclink
     → Page statique (SafeLinks la scanne sans consommer le token)
     → Utilisateur clique "Confirmer" → verifyOtp({ token_hash }) → session créée
6. Session stockée dans un cookie sécurisé (géré par @supabase/ssr)
7. Redirect → /contacts
```

### Pourquoi /auth/confirm ?

Microsoft SafeLinks (protection anti-phishing Outlook) pré-fetch tous les liens
dans les emails. Si le magic link pointait directement sur GoTrue
(`/auth/v1/verify?token=...`), ce pré-fetch consommerait le token one-time
avant que l'utilisateur clique → connexion impossible.

La page `/auth/confirm` est du HTML pur qui ne touche pas GoTrue.
Le token n'est consommé que lors du clic explicite sur "Confirmer".

### Administrateurs backoffice

```
1. Admin → pipeleads.app/admin/login
2. Email + mot de passe → createBrowserClient(NEXT_PUBLIC_SUPABASE_URL)
   (connexion sur le Supabase master)
3. requireAdminAuth() dans chaque Server Component admin :
   a. Lit la session depuis les cookies (createServerClient)
   b. Vérifie que user.email est dans admin_users (via service role)
   c. Sinon redirect /admin/login
```

---

## Commandes de développement

```bash
# Installer les dépendances
npm install

# Copier et remplir les variables d'environnement
cp .env.example .env.local

# Démarrer le serveur de développement
npm run dev

# Build de production
npm run build

# Vérifier les types TypeScript
npx tsc --noEmit

# Linter
npm run lint
```

### Tester le multi-tenant en local

1. Ajouter dans `/etc/hosts` :
   ```
   127.0.0.1 client1.localhost
   ```
2. Renseigner `MASTER_SUPABASE_URL` et `MASTER_SUPABASE_SERVICE_KEY` dans `.env.local`
3. Lancer `npm run dev`
4. Accéder à `http://client1.localhost:3000`

Le middleware détecte le suffixe `.localhost`, extrait le slug `client1`,
et interroge le master Supabase pour résoudre le tenant.

En l'absence de sous-domaine (`localhost:3000`), le middleware utilise les variables
`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` comme projet par défaut.

---

## Dépannage

**"Adresse email non reconnue"** — L'email n'existe pas dans le projet Supabase du tenant.
Aller dans Authentication → Users → Add user (ou utiliser le flow d'invitation manager).

**Redirect loop sur /login** — Session non créée. Vérifier que les variables
`NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` correspondent bien
au bon projet Supabase (master en prod, tenant en dev local multi-tenant).

**"Magic link déjà utilisé"** — SafeLinks a consommé le token. Vérifier que le
template email GoTrue pointe vers `/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink`
et non directement vers l'endpoint GoTrue.

**tenant-not-found** — Le slug du sous-domaine n'existe pas dans la table `tenants`
du master, ou `is_active = false`. Vérifier via le backoffice `/admin`.

**Admin : accès refusé après connexion** — L'email n'est pas dans la table `admin_users`
du master. Insérer manuellement via le SQL Editor.

**init-schema échoue** — Vérifier que `SUPABASE_MANAGEMENT_API_KEY` est un PAT valide
(non expiré) avec les droits nécessaires. En self-hosted, initialiser le schéma
manuellement via le SQL Editor du projet tenant.
