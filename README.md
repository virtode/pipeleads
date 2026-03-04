# PipeLeads

Application web de gestion de contacts et de leads. Un seul déploiement Vercel sert plusieurs clients via des sous-domaines (`client1.pipeleads.app`, `client2.pipeleads.app`).

---

## Architecture multi-tenant

### Vue d'ensemble

```
Requête → client1.pipeleads.app
           ↓
       middleware.ts
           ↓ (interroge master Supabase)
       Tenant résolu → headers injectés (x-tenant-*)
           ↓
       Server Components / API Routes
       → createClient() lit les headers → connecte au bon Supabase tenant
```

### Projets Supabase

| Projet | Rôle |
|---|---|
| **Master** | Registre des tenants (`tenants`, `admin_users`). Accès uniquement via service role key. |
| **Par tenant** | Données métier (contacts, pipelines…) + table `tenant_users` (rôles). |

---

## Onboarding d'un nouveau client

### 1. Créer un projet Supabase pour le tenant

1. Aller sur [supabase.com](https://supabase.com) → nouveau projet.
2. Appliquer les migrations dans l'ordre :
   ```
   supabase/migrations/001_initial_schema.sql
   supabase/migrations/002_stytch_auth.sql
   ...
   supabase/migrations/007_tenant_users.sql
   ```
3. Noter l'URL, l'Anon Key et la Service Role Key du projet.

### 2. Créer le tenant dans le backoffice admin

1. Aller sur `pipeleads.app/admin` → se connecter.
2. Tenants → Nouveau client.
3. Remplir : slug, nom de l'entreprise, credentials Supabase, email du manager (optionnel).
4. Soumettre → le tenant est créé et le manager reçoit une invitation par email.

### 3. Configurer le sous-domaine sur Vercel

Dans les paramètres du projet Vercel, ajouter le domaine `*.pipeleads.app` (wildcard).
Vercel route automatiquement tous les sous-domaines vers le même déploiement.

---

## Tester en local

### Mode solo (sans tenant)

```bash
npm run dev
# → http://localhost:3000
```

Le middleware détecte `localhost:3000` et ne résout aucun tenant (fallback variables d'env).

### Mode tenant en local

1. Ajouter dans `/etc/hosts` :
   ```
   127.0.0.1 client1.localhost
   ```
2. Lancer le serveur de dev :
   ```bash
   npm run dev
   ```
3. Accéder via `http://client1.localhost:3000`.

Le middleware détecte `.localhost` et extrait le slug `client1`.

> **Note :** pour que la résolution fonctionne, `MASTER_SUPABASE_URL` et `MASTER_SUPABASE_SERVICE_KEY` doivent être renseignés dans `.env.local`.

---

## Structure des rôles

### Rôles tenant (`tenant_users.role`)

| Rôle | Accès |
|---|---|
| `manager` | Accès complet + gestion de l'équipe (invitations, changement de rôles, révocations) |
| `member` | Accès en lecture/écriture aux données CRM uniquement |

### Admin backoffice

Les admins sont enregistrés dans la table `admin_users` du master Supabase.
Ils accèdent au backoffice via `pipeleads.app/admin`.

---

## Variables d'environnement

Copier `.env.example` → `.env.local` et remplir :

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du Supabase courant (dev local / tenant) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key du Supabase courant |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key du tenant courant |
| `MASTER_SUPABASE_URL` | URL du Supabase master (registre tenants) |
| `MASTER_SUPABASE_SERVICE_KEY` | Service role key du master |
| `NEXT_PUBLIC_ROOT_DOMAIN` | Domaine racine (`pipeleads.app` en prod) |

---

## Structure des dossiers (multi-tenant)

```
middleware.ts                      # Résolution tenant par sous-domaine
lib/
  tenant/
    context.ts                     # getTenantFromHeaders() — Server Components
    useTenant.ts                   # useTenant() hook — Client Components
    roles.ts                       # getUserRole, isManager, withManagerRole
  admin/
    auth.ts                        # createMasterAdminClient, requireAdminAuth
  supabase/
    client.ts                      # createClient({ url, anonKey }) — browser
    server.ts                      # createClient() — lit x-tenant-* headers
app/
  (admin)/                         # Backoffice admin (pipeleads.app/admin)
    layout.tsx
    login/page.tsx
    dashboard/page.tsx
    tenants/
      page.tsx                     # Liste tenants
      new/page.tsx                 # Créer un tenant
      [slug]/page.tsx              # Détail tenant
  (app)/
    settings/
      team/page.tsx                # Gestion équipe (managers only)
  api/
    tenant/me/route.ts             # Infos tenant courant (public)
    team/route.ts                  # GET liste membres (manager)
    team/invite/route.ts           # POST invitation (manager)
    team/[userId]/route.ts         # DELETE révocation (manager)
    team/[userId]/role/route.ts    # PATCH changement rôle (manager)
    admin/
      tenants/route.ts             # POST créer tenant
      tenants/check-slug/route.ts  # GET vérifier slug
      tenants/[slug]/toggle/       # POST activer/désactiver
      tenants/[slug]/invite-manager/ # POST inviter manager
      logout/route.ts              # POST déconnexion admin
supabase/migrations/
  006_master_tenants.sql           # Tables master (tenants, admin_users)
  007_tenant_users.sql             # Table tenant_users (par tenant)
```

---

## Démarrage local

```bash
npm install
cp .env.example .env.local
# remplir .env.local
npm run dev
```
