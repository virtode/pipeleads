# AUDIT.md — PipeLeads Migration Audit

> Généré le 2026-02-28 · Audit de la base de code existante et plan de migration vers le stack cible.
> **Aucun fichier source n'a été modifié dans ce document.**

---

## Table des matières

1. [Stack actuel — inventaire complet](#1-stack-actuel--inventaire-complet)
2. [Analyse des dépendances](#2-analyse-des-dépendances)
3. [Écarts avec le stack cible](#3-écarts-avec-le-stack-cible)
4. [Analyse détaillée par migration](#4-analyse-détaillée-par-migration)
5. [Plan de migration](#5-plan-de-migration)

---

## 1. Stack actuel — inventaire complet

### Framework & Runtime
| Composant | Version actuelle | Notes |
|---|---|---|
| `next` | **16.1.6** | App Router activé, pas de pages/ |
| `react` | 19.2.3 | Stable |
| `react-dom` | 19.2.3 | Stable |
| `typescript` | ^5 | `strict: true` activé |

### Authentification
| Composant | Version actuelle | Notes |
|---|---|---|
| `@stytch/nextjs` | ^22.0.2 | Magic Link + OAuth Google |

### Base de données & ORM
| Composant | Version actuelle | Notes |
|---|---|---|
| `@supabase/supabase-js` | ^2.97.0 | Client direct, pas d'ORM |
| `@supabase/ssr` | ^0.8.0 | SSR cookie helpers |

### Styling
| Composant | Version actuelle | Notes |
|---|---|---|
| `tailwindcss` | **^4** | ✅ Déjà sur v4 |
| `@tailwindcss/postcss` | ^4 | Plugin PostCSS v4 |
| `tw-animate-css` | ^1.4.0 | Animations CSS |

### Composants UI
| Composant | Version actuelle | Notes |
|---|---|---|
| `shadcn` (CLI) | ^3.8.5 (devDep) | ✅ shadcn/ui "new-york" style |
| `radix-ui` | ^1.4.3 | Peer dep de shadcn |
| `class-variance-authority` | ^0.7.1 | |
| `clsx` | ^2.1.1 | |
| `tailwind-merge` | ^3.5.0 | |
| `cmdk` | ^1.1.1 | Command palette |
| `next-themes` | ^0.4.6 | Dark mode |
| `lucide-react` | ^0.575.0 | Icônes |
| `sonner` | ^2.0.7 | Toasts |

### Formulaires & Validation
| Composant | Version actuelle | Notes |
|---|---|---|
| `react-hook-form` | ^7.71.2 | ✅ Conforme |
| `@hookform/resolvers` | ^5.2.2 | ✅ |
| `zod` | **^4.3.6** | ✅ Déjà sur v4 |

### State management & Data fetching
| Composant | Version actuelle | Notes |
|---|---|---|
| `@tanstack/react-query` | ^5.90.21 | TanStack Query v5 |
| `@tanstack/react-table` | ^8.21.3 | TanStack Table v8 |
| `@tanstack/react-virtual` | ^3.13.19 | Virtualisation listes |

### Drag & Drop
| Composant | Version actuelle | Notes |
|---|---|---|
| `@dnd-kit/core` | ^6.3.1 | ✅ Conforme |
| `@dnd-kit/sortable` | ^10.0.0 | ✅ Conforme |
| `@dnd-kit/utilities` | ^3.2.2 | ✅ Conforme |

### IA
| Composant | Version actuelle | Notes |
|---|---|---|
| `@anthropic-ai/sdk` | ^0.78.0 | Direct SDK, pas de streaming |

### Intégrations
| Composant | Version actuelle | Notes |
|---|---|---|
| `@notionhq/client` | ^5.9.0 | ✅ Conforme |
| `recharts` | ^3.7.0 | ✅ Conforme |

---

## 2. Analyse des dépendances

### Structure des fichiers clés

```
lib/
├── supabase/
│   ├── client.ts        → createBrowserClient() de @supabase/ssr
│   ├── server.ts        → createServerClient() avec cookie management
│   └── types.ts         → Types générés via Supabase CLI
├── stytch/
│   └── client.ts        → createStytchClient() — côté client uniquement
├── ai/
│   └── agent.ts         → Anthropic SDK direct, 2 fonctions principales
└── notion/
    ├── crypto.ts         → AES-256-GCM avec Node.js crypto
    └── sync.ts           → Client Notion, pagination, rate limiting

app/api/
├── ai/enrich/route.ts   → JWT decode custom, rate limiting in-memory, appel agent.ts
├── notion/config/route.ts
├── notion/sync/route.ts
└── notion/test/route.ts

hooks/
├── useContacts.ts        → TanStack Query, appels Supabase directs
├── usePipelines.ts       → TanStack Query, appels Supabase directs
└── useReports.ts         → TanStack Query, appels Supabase directs
```

### Patrons d'authentification

**JWT decode manuel** dans toutes les API routes :
```typescript
// Pattern répété dans chaque route API
function decodeJwtPayload(token: string): { sub?: string; exp?: number } | null
async function getSessionUserId(): Promise<string | null>
```

**RLS Supabase** utilise `auth.jwt() ->> 'sub'` pour extraire le Stytch user ID (text).

---

## 3. Écarts avec le stack cible

### Résumé des gaps

| Composant cible | Statut actuel | Gap | Priorité |
|---|---|---|---|
| Next.js 15 (App Router) | Next.js **16.1.6** | Version supérieure — pas de downgrade nécessaire | ✅ Aucun |
| TypeScript strict | `strict: true` activé | ✅ Conforme | ✅ Aucun |
| Tailwind CSS **v4** | Tailwind **v4** | ✅ Déjà migré | ✅ Aucun |
| shadcn/ui | shadcn/ui installé | ✅ Conforme | ✅ Aucun |
| Zod | Zod **v4.3.6** | ✅ Déjà sur v4 | ✅ Aucun |
| React Hook Form | v7.71.2 | ✅ Conforme | ✅ Aucun |
| **Drizzle ORM** | Raw Supabase client | ❌ Absent | 🔴 Haute complexité |
| **Vercel AI SDK** | @anthropic-ai/sdk direct | ❌ Non migré | 🟡 Complexité moyenne |
| **Better Auth** | Stytch | ❌ Non migré | 🔴 Haute complexité |
| **tRPC** | Plain Route Handlers | ❌ Absent | 🟡 Complexité élevée |

### Gaps confirmés : 4 migrations réelles

1. **Drizzle ORM** — remplace le client Supabase direct
2. **Vercel AI SDK** — remplace `@anthropic-ai/sdk`
3. **Better Auth** — remplace Stytch
4. **tRPC** — ajoute une couche d'API typée

---

## 4. Analyse détaillée par migration

---

### 4.1 Drizzle ORM

**Impact : FORT · Complexité : ÉLEVÉE**

#### Situation actuelle
- Toutes les queries utilisent le client Supabase JS directement (`supabase.from('table').select(...)`)
- Types dérivés automatiquement depuis `lib/supabase/types.ts` (généré par Supabase CLI)
- RLS Supabase gère l'isolation des données au niveau DB
- Pas d'ORM, pas de migrations outillées côté app

#### Ce que Drizzle apporte
- Schéma DB en TypeScript (source of truth)
- Queries type-safe avec inférence automatique
- Migrations versionnées (`drizzle-kit`)
- Compatible PostgreSQL (Supabase expose un endpoint PostgreSQL direct)

#### Risque architectural majeur ⚠️

Drizzle se connecte via **connection string PostgreSQL directe**, ce qui **bypasse le Row Level Security (RLS)** de Supabase. Pour maintenir la sécurité :

**Option A — Drizzle + RLS maintenu manuellement** :
- Connexion PostgreSQL directe (contourne RLS)
- Chaque query doit filtrer par `user_id` au niveau applicatif
- Perd le filet de sécurité RLS → risque de fuite de données si oubli

**Option B — Drizzle pour le schéma/migrations, Supabase client pour les queries** :
- Drizzle comme outil de migration uniquement
- Supabase client continue pour les queries (RLS préservé)
- Meilleur compromis sécurité/DX

**Option C — Supabase Auth + Service Role Key côté server** :
- Queries server-side avec service role (bypasse RLS intentionnellement)
- Filtrage manuel `user_id` dans toutes les queries
- Acceptable car l'app est solo et les API routes vérifient déjà la session

#### Fichiers affectés
```
lib/supabase/client.ts          → Remplacer par lib/db/client.ts (Drizzle)
lib/supabase/server.ts          → Remplacer par lib/db/server.ts
lib/supabase/types.ts           → Remplacer par lib/db/schema.ts (Drizzle schema)
hooks/useContacts.ts            → Toutes les queries Supabase → Drizzle
hooks/usePipelines.ts           → Idem
hooks/useReports.ts             → Idem
app/api/ai/enrich/route.ts      → Queries Supabase → Drizzle
app/api/notion/config/route.ts  → Idem
app/api/notion/sync/route.ts    → Idem
supabase/migrations/*.sql       → Convertir en drizzle-kit migrations
```

**Nb de fichiers impactés : ~15**

---

### 4.2 Vercel AI SDK

**Impact : MOYEN · Complexité : MOYENNE**

#### Situation actuelle
- `lib/ai/agent.ts` : 2 fonctions (`enrichContactProfile`, `enrichCompanyNews`)
- Utilise `@anthropic-ai/sdk` directement avec `client.messages.create()`
- Retry logic custom (exponential backoff pour erreurs 529)
- Web search tool : `{ type: 'web_search_20250305' }`
- Réponse bloquante (pas de streaming) — l'UI affiche un état "loading"

#### Ce que Vercel AI SDK apporte
- `streamText()` / `generateText()` avec Anthropic provider
- Hooks React : `useChat()`, `useCompletion()` pour streaming natif
- `@ai-sdk/anthropic` provider — même capacité web search
- Gestion des tool calls simplifiée
- Gestion des erreurs standardisée

#### Points d'attention
- La **web search tool** (`web_search_20250305`) est une capability Anthropic native — le Vercel AI SDK l'expose différemment (comme `tool()`), vérifier la compatibilité
- L'AIEnrichmentPanel.tsx n'utilise pas de streaming aujourd'hui — migration optionnelle si on garde la réponse complète

#### Fichiers affectés
```
lib/ai/agent.ts                 → Réécrire avec generateText() de ai/anthropic
app/api/ai/enrich/route.ts      → Adapter pour streamText() si streaming voulu
components/contacts/AIEnrichmentPanel.tsx → Optionnel: useCompletion() pour streaming
package.json                    → Ajouter ai + @ai-sdk/anthropic, retirer @anthropic-ai/sdk
```

**Nb de fichiers impactés : 3–4**

---

### 4.3 Better Auth

**Impact : FORT · Complexité : ÉLEVÉE**

#### Situation actuelle
- Stytch Magic Link + OAuth Google
- JWT decode **manuel** dans chaque API route (custom `decodeJwtPayload`)
- Cookie : `stytch_session_jwt` / `stytch_session`
- RLS Supabase utilise `auth.jwt() ->> 'sub'` (Stytch user ID en text)
- `StytchProvider` dans `components/shared/providers.tsx`
- Callbacks OAuth via `app/(auth)/callback/page.tsx`

#### Ce que Better Auth apporte
- Auth multi-provider (Email/Password, Magic Link, OAuth) sans vendor lock-in
- Sessions gérées en DB (table `sessions` + `accounts`)
- Middleware natif Next.js pour protection des routes
- Plugins : `twoFactor`, `organization`, `passkey`, etc.
- Compatible avec Drizzle (plugin officiel) ou Prisma

#### Risques & complexité

**Impact sur Supabase RLS** — C'est le point de blocage principal :
- Stytch injecte son JWT dans les cookies utilisés par Supabase
- Better Auth génère ses propres JWTs avec un format différent
- Il faudra soit :
  - **A** : Reconfigurer Supabase pour accepter les JWTs Better Auth (custom JWT secret dans Supabase → Auth settings)
  - **B** : Abandonner RLS et filtrer par `user_id` côté applicatif
  - **C** : Utiliser Supabase Auth natif (GoTrue) et rester dans l'écosystème Supabase — élimine Stytch ET Better Auth

#### Option alternative recommandée : **Supabase Auth natif**
L'app est en solo usage, Supabase Auth supporte nativement :
- Magic Link (email OTP)
- OAuth Google
- JWT natif compatible RLS sans configuration supplémentaire
- `createServerClient` gère la session automatiquement

#### Fichiers affectés (si Better Auth)
```
lib/stytch/client.ts                   → Supprimer, remplacer par lib/auth/client.ts
app/(auth)/login/page.tsx              → Réécrire le formulaire login
app/(auth)/callback/page.tsx           → Réécrire le callback OAuth
components/shared/providers.tsx        → Retirer StytchProvider
app/api/ai/enrich/route.ts             → Remplacer getSessionUserId()
app/api/notion/config/route.ts         → Idem
app/api/notion/sync/route.ts           → Idem
app/api/notion/test/route.ts           → Idem
supabase/migrations/002_stytch_auth.sql → Nouvelle migration pour Better Auth/Supabase Auth
```

**Nb de fichiers impactés : ~10 + 1 nouvelle migration SQL**

---

### 4.4 tRPC

**Impact : MOYEN · Complexité : ÉLEVÉE**

#### Situation actuelle
- 4 Route Handlers dans `app/api/` — pas de typage partagé client/serveur
- Types définis manuellement et dupliqués entre client et serveur
- Hooks TanStack Query appellent `fetch()` directement (en passant par les hooks custom)

#### Ce que tRPC apporte
- Types inférés de bout en bout (serveur → client sans code-gen)
- Intégration native avec TanStack Query v5
- Procedures typées : `query`, `mutation`, `subscription`
- Middleware pour auth, logging, etc.

#### Points d'attention
- tRPC implique de **réécrire toutes les API routes** en procédures tRPC
- Les Route Handlers simples peuvent rester (Notion callback, webhooks)
- L'intégration avec TanStack Query v5 est native (adapteur officiel)
- Ajoute de la complexité de setup pour un usage solo

#### Alternative plus légère : **Route Handlers avec Zod + types partagés**
Pour une app solo, des Route Handlers typés avec Zod (en-tête et réponse) + types partagés offrent 80% des bénéfices de tRPC sans la complexité.

#### Fichiers affectés
```
app/api/**/*.ts                  → Convertir en tRPC router
hooks/useContacts.ts             → Utiliser tRPC client + TanStack Query
hooks/usePipelines.ts            → Idem
hooks/useReports.ts              → Idem
lib/trpc/                        → Nouveau dossier (router, context, client)
app/api/trpc/[trpc]/route.ts     → Handler HTTP tRPC
components/shared/providers.tsx  → Ajouter tRPC Provider
```

**Nb de fichiers impactés : ~12**

---

## 5. Plan de migration

### Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│  PRIORITÉ HAUTE — Impact fort, complexité faible/moyenne        │
│                                                                 │
│  ① Vercel AI SDK (remplace @anthropic-ai/sdk)                  │
│     Impact: Streaming AI, meilleure DX, moins de code custom    │
│     Complexité: MOYENNE (3–4 fichiers, API compatible)          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│  PRIORITÉ HAUTE — Impact fort, complexité élevée                │
│                                                                 │
│  ② Auth (Stytch → Supabase Auth natif OU Better Auth)          │
│     Impact: Sécurité, maintenance, vendor lock-in               │
│     Complexité: ÉLEVÉE (10+ fichiers + migration SQL)           │
│     Prérequis: Décision sur Option A/B/C (voir §4.3)           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│  SECONDAIRE — Impact moyen, complexité élevée                   │
│                                                                 │
│  ③ Drizzle ORM (remplace Supabase client direct)               │
│     Impact: Type-safety, migrations versionnées                 │
│     Complexité: ÉLEVÉE (15+ fichiers + RLS à reconsidérer)     │
│     Prérequis: Auth migrée (RLS dépend du système auth)         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│  OPTIONNEL — Impact faible pour usage solo                      │
│                                                                 │
│  ④ tRPC (ou Route Handlers typés avec Zod)                     │
│     Impact: DX améliorée, pas de valeur ajoutée fonctionnelle   │
│     Alternative: Types partagés Zod sans tRPC overhead          │
│     Complexité: ÉLEVÉE (12+ fichiers)                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Migrations prioritaires

#### ① Vercel AI SDK — Impact fort · Complexité moyenne

**Justification :** Migration isolée (3–4 fichiers), pas de dépendances avec les autres migrations, apporte du streaming sans refactor global.

**Étapes :**
1. Installer `ai` + `@ai-sdk/anthropic`
2. Réécrire `lib/ai/agent.ts` avec `generateText()` et `streamText()`
3. Adapter `app/api/ai/enrich/route.ts` pour streaming (optionnel)
4. Mettre à jour `components/contacts/AIEnrichmentPanel.tsx` pour le streaming
5. Retirer `@anthropic-ai/sdk`

**Fichiers :**
- `lib/ai/agent.ts`
- `app/api/ai/enrich/route.ts`
- `components/contacts/AIEnrichmentPanel.tsx`
- `package.json`

---

### Migrations secondaires

#### ② Auth — Impact fort · Complexité élevée

**Recommandation : Supabase Auth natif plutôt que Better Auth**

Pour une app **solo**, Supabase Auth (GoTrue) est le choix optimal car :
- Intégration native avec RLS (pas de reconfiguration JWT)
- Supporte Magic Link + OAuth Google (parité fonctionnelle avec Stytch)
- Élimine la dépendance Stytch sans en créer une nouvelle (Better Auth)
- `@supabase/ssr` gère déjà la session server-side

Si Better Auth est préféré (plus de contrôle, DB locale) : décider d'abord du mode RLS (§4.3).

**Étapes (Supabase Auth) :**
1. Activer Supabase Auth dans le dashboard (Magic Link + Google OAuth)
2. Réécrire `app/(auth)/login/page.tsx`
3. Réécrire `app/(auth)/callback/page.tsx`
4. Créer `middleware.ts` pour protection des routes (pattern Supabase SSR)
5. Remplacer `getSessionUserId()` dans les API routes par `supabase.auth.getUser()`
6. Retirer `StytchProvider` de `providers.tsx`
7. Nouvelle migration SQL : supprimer les policies Stytch, recréer avec `auth.uid()`
8. Retirer `@stytch/nextjs`

**Fichiers :**
- `lib/stytch/client.ts` (supprimer)
- `app/(auth)/login/page.tsx`
- `app/(auth)/callback/page.tsx`
- `middleware.ts` (créer)
- `components/shared/providers.tsx`
- `app/api/ai/enrich/route.ts`
- `app/api/notion/config/route.ts`
- `app/api/notion/sync/route.ts`
- `app/api/notion/test/route.ts`
- `supabase/migrations/005_supabase_auth.sql` (nouvelle migration)

#### ③ Drizzle ORM — Impact moyen · Complexité élevée

**Recommandation conditionnelle** : Ne migrer vers Drizzle que si la migration Auth a été faite avec Supabase Auth natif (RLS préservé via `auth.uid()`).

**Approche recommandée : Drizzle pour les migrations uniquement (Option B du §4.1)**

Pour une app solo avec Supabase, utiliser Drizzle uniquement comme **outil de migration** (drizzle-kit) tout en gardant le client Supabase pour les queries préserve le RLS et simplifie drastiquement la migration.

Si migration complète des queries souhaitée :
- Définir le schéma Drizzle dans `lib/db/schema.ts`
- Connecter via `DATABASE_URL` (Supabase connection pooler)
- Réécrire toutes les queries dans les hooks et API routes
- Implémenter le filtrage `user_id` manuel (RLS contourné)

**Fichiers (si migration complète) :**
- `lib/supabase/types.ts` → `lib/db/schema.ts`
- `lib/supabase/client.ts` → `lib/db/client.ts` (Drizzle instance)
- `lib/supabase/server.ts` → `lib/db/server.ts`
- `hooks/useContacts.ts` (15+ queries)
- `hooks/usePipelines.ts` (10+ queries)
- `hooks/useReports.ts` (5+ queries)
- `app/api/**/*.ts` (toutes les routes)
- `supabase/migrations/` → `drizzle/` (schema + migrations)

---

### Migrations optionnelles

#### ④ tRPC — Impact faible pour usage solo · Complexité élevée

**Recommandation : Non prioritaire — alternative légère suffisante**

Pour une app solo avec 4 routes API, tRPC ajoute une complexité de setup (provider, adapter, router) sans bénéfice fonctionnel tangible.

**Alternative recommandée :** Types Zod partagés entre Route Handlers et client :
```typescript
// lib/api/schemas.ts
export const EnrichResponseSchema = z.object({ ... })
export type EnrichResponse = z.infer<typeof EnrichResponseSchema>
// Partagé dans route.ts ET dans useContacts.ts via import
```

Si tRPC est souhaité après les autres migrations :
- Setup `lib/trpc/` (router, context, client)
- Convertir les Route Handlers en procedures
- Adapter les hooks TanStack Query

---

### Ordre de migration recommandé

```
Semaine 1  ①  Vercel AI SDK
               → Migration isolée, risque minimal, gain immédiat

Semaine 2  ②  Auth → Supabase Auth natif
               → Prérequis pour ③ (RLS)
               → Éliminer Stytch + JWT decode custom

Semaine 3  ③  Drizzle ORM (optionnel)
               → Uniquement si schéma typé souhaité
               → Recommandé en mode "migrations only" (drizzle-kit)

—          ④  tRPC
               → Reporter jusqu'après ①②③
               → Réévaluer si vraiment utile en usage solo
```

---

### Matrice de décision avant de commencer

Avant de valider le plan, répondre à ces questions :

| Question | Impact sur le plan |
|---|---|
| Veux-tu conserver le **RLS Supabase** ? | Si oui → Supabase Auth natif pour ② ; Drizzle en mode migrations-only pour ③ |
| Veux-tu du **streaming AI** dans l'UI ? | Si oui → Priorité forte sur ① avec `streamText()` |
| tRPC est-il vraiment nécessaire ? | Si non → Remplacer par Zod partagé (beaucoup moins de code) |
| Rester sur **Next.js 16** ? | Oui — pas de downgrade vers 15, fonctionnellement équivalent |

---

### Résumé — ce qui ne change PAS

Ces éléments du stack sont déjà conformes ou supérieurs au stack cible :

| Composant | Statut |
|---|---|
| Next.js App Router | ✅ (v16.1.6, supérieur à la cible v15) |
| TypeScript strict | ✅ |
| Tailwind CSS v4 | ✅ |
| shadcn/ui | ✅ |
| Zod v4 | ✅ |
| React Hook Form v7 | ✅ |
| TanStack Query v5 | ✅ |
| TanStack Table v8 | ✅ |
| dnd-kit | ✅ |
| Recharts | ✅ |
| Notion SDK | ✅ |
| lucide-react | ✅ |

**4 migrations réelles à effectuer** sur les ~20 composants du stack.

---

*Fin du rapport d'audit. Attente de validation avant toute modification du code source.*
