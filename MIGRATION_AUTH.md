# Migration Auth : Stytch → Supabase Auth natif

## Contexte

L'application utilisait Stytch pour l'authentification (Magic Link). Cette migration
passe à **Supabase Auth natif** (Magic Link uniquement) afin de simplifier la stack
et de restaurer un RLS propre sans dépendance externe.

---

## Changements effectués

### 1. Dépendances

| Action | Package |
|---|---|
| Supprimé | `@stytch/nextjs` |
| Conservé | `@supabase/supabase-js`, `@supabase/ssr` |

### 2. Authentification

| Fichier | Changement |
|---|---|
| `app/(auth)/login/page.tsx` | `supabase.auth.signInWithOtp()` remplace `stytch.magicLinks.email.loginOrCreate()`. `shouldCreateUser: false` pour interdire les inscriptions libres. |
| `app/(auth)/callback/page.tsx` | **Supprimé** — remplacé par le Route Handler ci-dessous. |
| `app/auth/callback/route.ts` | **Créé** — Route Handler GET qui échange le `code` contre une session via `supabase.auth.exchangeCodeForSession()`. |
| `middleware.ts` | **Créé** — Protège toutes les routes app. Redirige vers `/login` si pas de session. Rafraîchit le cookie de session Supabase à chaque requête. |

### 3. Composants & pages

| Fichier | Changement |
|---|---|
| `components/shared/providers.tsx` | `StytchProvider` supprimé. Plus que `ThemeProvider` + `QueryClientProvider`. |
| `components/shared/sidebar.tsx` | `handleLogout` : `supabase.auth.signOut()` remplace `stytch.session.revoke()`. |
| `app/(app)/settings/page.tsx` | `useStytch` + `useStytchUser` remplacés par `useState` + `useEffect` + `supabase.auth.getUser()`. |
| `app/(app)/contacts/page.tsx` | `useStytchSession` supprimé. Guard `enabled: !!session` retiré (middleware gère l'auth). |
| `app/page.tsx` | Simplifié — `redirect('/contacts')` uniquement. |

### 4. Hooks

| Fichier | Changement |
|---|---|
| `hooks/useContacts.ts` | `useStytchSession` supprimé. Guards `enabled: !!session` retirés. `useCreateContact` utilise `supabase.auth.getUser()` pour récupérer `user.id`. |
| `hooks/usePipelines.ts` | Idem. `useCreatePipeline` utilise `supabase.auth.getUser()`. |
| `hooks/useReports.ts` | `useStytchSession` supprimé. Guards `enabled: !!session` retirés ou simplifiés. |

### 5. Composants clients

| Fichier | Changement |
|---|---|
| `components/pipeline/PipelineEditor.tsx` | `useStytchSession` supprimé. |
| `components/contacts/ImportCSVDialog.tsx` | `session.user_id` → `supabase.auth.getUser()` dans `startImport()`. |
| `components/contacts/ImportVCFDialog.tsx` | Idem. |

### 6. Routes API

Toutes les routes remplacent le décodage JWT Stytch (`decodeJwtPayload` +
`getSessionUserId`) par `supabase.auth.getUser()`.

| Route | Changement |
|---|---|
| `app/api/ai/enrich/route.ts` | Auth Supabase. `userId` n'est plus nécessaire (RLS filtre via `auth.uid()`). |
| `app/api/notion/config/route.ts` | Auth Supabase. `.eq('user_id', user.id)` remplace `.eq('user_id', userId)`. |
| `app/api/notion/sync/route.ts` | Idem. |
| `app/api/notion/test/route.ts` | Idem. |

### 7. Base de données

**Migration `005_supabase_auth.sql`** :
- Supprime les policies "open" de la migration 004 (`contacts_open`, `pipelines_open`, etc.)
- Restaure des policies propres : `auth.uid()::text = user_id`
- Le cast `::text` est nécessaire car `user_id` est de type `text` (migration 002) et `auth.uid()` retourne un UUID

---

## Configuration Supabase Dashboard

Les points suivants doivent être configurés dans le dashboard Supabase :

1. **Email provider activé** (Authentication → Providers → Email)
   - "Enable email provider" : ✅
   - "Confirm email" : ✅ (Magic Link)
   - "Disable sign ups" : ✅ (usage solo — `shouldCreateUser: false` côté code aussi)

2. **Redirect URLs** (Authentication → URL Configuration)
   - Site URL : `http://localhost:3000` (dev) / URL de prod
   - Redirect URLs autorisées : `http://localhost:3000/auth/callback`, `https://ton-domaine.com/auth/callback`

---

## Flux d'authentification

```
1. Utilisateur saisit son email sur /login
2. supabase.auth.signInWithOtp({ email, shouldCreateUser: false })
3. Supabase envoie un Magic Link → ${origin}/auth/callback?code=xxx
4. Route Handler GET /auth/callback lit le ?code
5. supabase.auth.exchangeCodeForSession(code) → session créée dans le cookie
6. Redirection vers / → middleware → /contacts
7. À chaque requête : middleware rafraîchit le cookie Supabase
8. Déconnexion : supabase.auth.signOut() → middleware redirige vers /login
```

---

## Notes

- Les `user_id` existants en base sont des Stytch IDs (format `user-uuid`). Ils ne
  correspondront pas aux nouveaux UUID Supabase. Pour une migration de données, il
  faudrait re-associer les contacts existants au nouveau `user.id`. Pour un usage solo,
  il suffit de recréer les données ou d'exécuter une mise à jour SQL manuelle.
- `lib/stytch/` supprimé intégralement.
