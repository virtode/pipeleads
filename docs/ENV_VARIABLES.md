# Variables d'environnement — PipeLeads

Liste exhaustive de toutes les variables nécessaires au fonctionnement de PipeLeads.

---

## Application Next.js

Ces variables sont à définir dans `.env.local` (dev) ou dans Coolify (production).

### Supabase Master

Le Supabase **master** est le projet central qui stocke le registre des tenants
et la liste des administrateurs backoffice. Il ne contient aucune donnée métier.

| Variable | Type | Obligatoire | Description |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `string` (URL) | ✅ | URL publique du projet Supabase **master**. Exposée côté client car utilisée pour la session admin (`/admin`) et comme fallback dev local. Exemple : `https://abcdefgh.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `string` (JWT) | ✅ | Anon key du Supabase **master**. Exposée côté client, sécurisée par les RLS policies. Trouvable dans Supabase → Settings → API → anon/public. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | `string` (JWT) | Non | Alias de l'anon key pour certaines intégrations Supabase SDK (optionnel). |
| `SUPABASE_SERVICE_ROLE_KEY` | `string` (JWT) | ✅ | Service role key du master. Bypass les RLS — **ne jamais exposer côté client**. Utilisée dans les Route Handlers admin uniquement. Trouvable dans Supabase → Settings → API → service_role. |
| `MASTER_SUPABASE_URL` | `string` (URL) | ✅ | URL interne du Supabase master. Utilisée par le middleware (côté serveur) pour résoudre les tenants via fetch direct. Peut être identique à `NEXT_PUBLIC_SUPABASE_URL` ou pointer vers une URL interne réseau. |
| `MASTER_SUPABASE_SERVICE_KEY` | `string` (JWT) | ✅ | Service role key du master côté serveur. Utilisée par le middleware et `lib/admin/auth.ts`. **Ne jamais exposer côté client.** |

> **Pourquoi deux paires de variables master ?**
> `NEXT_PUBLIC_*` est injectée dans le bundle client (nécessaire pour l'admin login côté navigateur).
> `MASTER_SUPABASE_*` reste purement serveur et est utilisée dans des contextes sans accès au bundle client (middleware Edge Runtime, Server Components).

### Supabase Management API

| Variable | Type | Obligatoire | Description |
|---|---|---|---|
| `SUPABASE_MANAGEMENT_API_KEY` | `string` | Conditionnel | Personal Access Token (PAT) Supabase cloud. Utilisé pour initialiser automatiquement le schéma SQL lors de l'onboarding d'un nouveau tenant. Générer sur [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens). **Non disponible en self-hosted** — dans ce cas, initialiser le schéma manuellement. |

### Domaine

| Variable | Type | Obligatoire | Description |
|---|---|---|---|
| `NEXT_PUBLIC_ROOT_DOMAIN` | `string` | ✅ | Domaine racine de l'application. Utilisé par le middleware pour extraire le slug tenant du sous-domaine. Valeur dev local : `localhost`. Valeur prod : `pipeleads.app`. |

### Anthropic (agent IA)

| Variable | Type | Obligatoire | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | `string` | Non | Clé API Anthropic. Utilisée par `app/api/ai/enrich/route.ts` pour les enrichissements de contacts via Claude. Sans cette clé, les pages s'affichent mais les requêtes d'enrichissement retournent une erreur 500. Format : `sk-ant-api03-...` |

### Notion

| Variable | Type | Obligatoire | Description |
|---|---|---|---|
| `NOTION_INTEGRATION_TOKEN` | `string` | Non | Token d'intégration Notion (Internal Integration). Présent dans `.env.example` mais le token Notion est en réalité saisi dans l'interface (Réglages → Intégration Notion) et stocké chiffré en base. Cette variable est une alternative pour un déploiement sans UI de configuration. |

### Variables legacy (non utilisées)

Ces variables sont présentes dans `.env.example` mais ne sont plus utilisées
dans le code — l'authentification Stytch a été remplacée par Supabase Auth OTP.

| Variable | Statut |
|---|---|
| `NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN` | **Inutilisée** — peut être supprimée |
| `STYTCH_PROJECT_ID` | **Inutilisée** — peut être supprimée |
| `STYTCH_SECRET` | **Inutilisée** — peut être supprimée |

---

## Supabase self-hosted (GoTrue) — par instance

Ces variables configurent le service GoTrue (moteur d'authentification) de chaque
instance Supabase self-hosted. À renseigner dans Coolify → Service → Environment Variables
ou dans le fichier `docker-compose.yml` Supabase.

### URLs et redirections

| Variable GoTrue | Description | Exemple |
|---|---|---|
| `GOTRUE_SITE_URL` | URL publique de référence — base des liens dans les emails auth | `https://pipeleads.app` (master), `https://client1.pipeleads.app` (tenant) |
| `GOTRUE_URI_ALLOW_LIST` | Liste des URLs de redirection autorisées après auth (séparées par virgules, wildcards supportés) | `https://*.pipeleads.app/**,http://localhost:3000/**` |
| `API_EXTERNAL_URL` | URL externe de l'API GoTrue (utilisée dans les emails) | `https://db.pipeleads.app` |

### Contrôle des inscriptions

| Variable GoTrue | Description | Valeur recommandée |
|---|---|---|
| `GOTRUE_DISABLE_SIGNUP` | Bloque toute création de compte par inscription libre | `true` (tenants) — les comptes sont créés via invitation admin uniquement |
| `GOTRUE_MAILER_AUTOCONFIRM` | Confirme automatiquement les nouveaux comptes sans email | `false` |

### Email / SMTP

| Variable GoTrue | Description | Exemple |
|---|---|---|
| `GOTRUE_SMTP_HOST` | Hôte du serveur SMTP | `smtp.sendgrid.net` |
| `GOTRUE_SMTP_PORT` | Port SMTP | `587` |
| `GOTRUE_SMTP_USER` | Login SMTP | `apikey` (SendGrid) |
| `GOTRUE_SMTP_PASS` | Mot de passe SMTP | `SG.xxx...` |
| `GOTRUE_SMTP_SENDER_NAME` | Nom affiché dans les emails | `PipeLeads` |
| `GOTRUE_MAILER_SENDER` | Adresse email expéditeur | `noreply@pipeleads.app` |
| `GOTRUE_SMTP_ADMIN_EMAIL` | Email admin GoTrue (interne) | `admin@pipeleads.app` |

### Templates email — configuration critique pour SafeLinks

GoTrue propose des templates email configurables. Le template **Magic Link** doit
être modifié pour pointer vers `/auth/confirm` au lieu de l'endpoint GoTrue direct.

**Template Magic Link (Authentication → Email Templates → Magic Link) :**

```html
<h2>Connexion PipeLeads</h2>
<p>Clique sur le lien ci-dessous pour te connecter.</p>
<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink">
    Confirmer ma connexion
  </a>
</p>
<p>Ce lien expire dans 1 heure.</p>
```

> Sans cette modification, Microsoft SafeLinks (Outlook) consomme le token one-time
> lors du scan de l'email, rendant le lien invalide avant le clic utilisateur.

### Variables Supabase PostgreSQL (par instance)

| Variable | Description |
|---|---|
| `POSTGRES_PASSWORD` | Mot de passe de la base PostgreSQL |
| `POSTGRES_DB` | Nom de la base (par défaut : `postgres`) |
| `POSTGRES_HOST` | Hôte PostgreSQL (interne Docker : `db`) |
| `POSTGRES_PORT` | Port PostgreSQL (par défaut : `5432`) |
| `JWT_SECRET` | Secret JWT — doit être unique par instance (min 32 chars) |
| `ANON_KEY` | Clé anonyme JWT — générée depuis `JWT_SECRET` |
| `SERVICE_ROLE_KEY` | Clé service role JWT — générée depuis `JWT_SECRET` |

---

## Traefik / Coolify

Coolify gère Traefik automatiquement. Ces paramètres sont configurés via l'interface
Coolify (Settings → Proxy) ou les labels Docker de chaque service.

| Paramètre Coolify | Description |
|---|---|
| Domaine principal | `pipeleads.app` + `*.pipeleads.app` (wildcard) |
| TLS | Let's Encrypt automatique via Traefik |
| Résolution wildcard | Nécessite que le DNS wildcard `*.pipeleads.app` soit configuré **avant** |
| Port Next.js | `3000` (interne container) |
| Health check | `GET /api/health` |

### Labels Docker utiles (si déploiement manuel)

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.pipeleads.rule=HostRegexp(`{subdomain:[a-z0-9-]+}.pipeleads.app`) || Host(`pipeleads.app`)"
  - "traefik.http.routers.pipeleads.entrypoints=websecure"
  - "traefik.http.routers.pipeleads.tls.certresolver=letsencrypt"
  - "traefik.http.services.pipeleads.loadbalancer.server.port=3000"
```

---

## Fichier .env.local — exemple complet

```bash
# ── Supabase Master ─────────────────────────────────────────────────────────
# Projet Supabase central (registre tenants + admin_users)
NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Variables serveur-only pour le middleware (peuvent être identiques aux NEXT_PUBLIC si même projet)
MASTER_SUPABASE_URL=https://abcdefgh.supabase.co
MASTER_SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ── Supabase Management API ─────────────────────────────────────────────────
SUPABASE_MANAGEMENT_API_KEY=sbp_...

# ── Domaine ─────────────────────────────────────────────────────────────────
NEXT_PUBLIC_ROOT_DOMAIN=pipeleads.app
# En dev local sans tenant : omettable (localhost sans sous-domaine)
# En dev local avec tenant : NEXT_PUBLIC_ROOT_DOMAIN=localhost

# ── Anthropic ───────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-api03-...

# ── Notion ─────────────────────────────────────────────────────────────────
# Optionnel — généralement configuré via l'interface
NOTION_INTEGRATION_TOKEN=secret_...
```
