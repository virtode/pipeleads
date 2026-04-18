# CLAUDE.md — PipeLeads

Lis ce fichier entièrement avant d'écrire la moindre ligne de code.

---

## Architecture

Application **SaaS multi-tenant** de gestion de contacts et de leads (CRM).  
Déployée sur **Hetzner (89.167.99.242) via Coolify**. Supabase **self-hosted**.

- **Isolation tenant** : sous-domaine (`tenant.pipeleads.app`) → `proxy.ts` (middleware Next.js) résout le tenant, injecte `x-tenant-id` dans les headers, rafraîchit la session Supabase.
- **RLS Supabase** : toutes les tables tenant ont `tenant_id IS NOT DISTINCT FROM current_tenant_id()`. La fonction `current_tenant_id()` lit le claim JWT custom posé par le middleware.
- **Master Supabase** : projet séparé pour le registre des tenants (`tenants`, `admin_users`). Accès via `createMasterAdminClient()` côté serveur uniquement.
- **Types Supabase** : `lib/supabase/types.ts` maintenu manuellement (port 5432 non exposé publiquement — régénérer via SSH sur le serveur).

---

## Stack

| Rôle | Package |
|---|---|
| Framework | Next.js 16 (App Router) |
| Langage | TypeScript 5 strict |
| Styling | Tailwind CSS 3 + shadcn/ui |
| BDD | Supabase (self-hosted) |
| Auth | Supabase Auth (Magic Link + OAuth Google) |
| State serveur | TanStack Query 5 |
| Formulaires | react-hook-form 7 + zod 3 |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable |
| Graphiques | recharts 2 |
| Agent IA | @anthropic-ai/sdk |
| Sync contacts | CardDAV (Radicale) via sync-service interne |

---

## Conventions essentielles

- `'use client'` uniquement si event handlers ou hooks — Server Components par défaut
- `createClient()` (server.ts) dans les Route Handlers et Server Components ; `useSupabaseClient()` dans les Client Components
- Pas de `any` TypeScript — `unknown` si le type est incertain
- Toutes les queries Supabase vérifient le champ `error` retourné
- TanStack Query pour tout le fetching côté client — pas de `fetch` directement dans les composants
- shadcn/ui en priorité avant tout composant custom
- Migrations SQL dans `supabase/migrations/` numérotées séquentiellement

## Ce qu'il ne faut PAS faire

- ❌ Exposer `SUPABASE_SERVICE_ROLE_KEY`, `MASTER_SUPABASE_SERVICE_KEY` ou `ANTHROPIC_API_KEY` côté client
- ❌ Utiliser `pages/` router — exclusivement `app/` router
- ❌ Ignorer silencieusement les erreurs Supabase (`const { data } = await supabase…` sans vérifier `error`)
- ❌ Utiliser Redux ou Zustand — TanStack Query pour l'état serveur, `useState`/`useReducer` pour l'état local
