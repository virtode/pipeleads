# Guide de prompts — LeadFlow CRM pour Claude Code

Copie-colle chaque prompt dans Claude Code **dans l'ordre**.
Attends que chaque étape soit terminée et validée avant de passer à la suivante.
Les prompts sont conçus pour être autonomes et progressifs.

---

## Avant de commencer

1. Crée un dossier `leadflow-crm` sur ton ordinateur
2. Place le fichier `CLAUDE.md` à la racine de ce dossier
3. Lance Claude Code dans ce dossier : `claude` (ou ouvre le dossier dans ton éditeur avec Claude Code)
4. Assure-toi d'avoir tes clés API sous la main (Supabase, Stytch, Anthropic, Notion)

---

## PROMPT 1 — Setup du projet

```
Initialise le projet LeadFlow CRM en suivant exactement les instructions du CLAUDE.md.

Effectue les actions suivantes dans l'ordre :
1. Crée un nouveau projet Next.js 15 avec TypeScript, Tailwind CSS et App Router dans le dossier courant (npx create-next-app@latest . --typescript --tailwind --app --src-dir false --import-alias "@/*")
2. Installe toutes les dépendances listées dans le CLAUDE.md
3. Initialise shadcn/ui (npx shadcn@latest init) avec le thème "zinc" et les paramètres par défaut
4. Installe les composants shadcn/ui nécessaires : button, input, label, card, dialog, sheet, dropdown-menu, table, badge, avatar, tabs, select, textarea, toast, tooltip, popover, command, separator
5. Crée la structure de dossiers complète décrite dans le CLAUDE.md
6. Crée le fichier .env.example avec toutes les variables listées dans le CLAUDE.md (valeurs vides)
7. Crée le fichier .env.local en me demandant mes clés une par une
8. Configure tsconfig.json avec strict: true
9. Crée lib/supabase/client.ts, lib/supabase/server.ts et lib/supabase/types.ts avec les configurations de base
10. Crée lib/stytch/client.ts avec la configuration Stytch
11. Mets à jour app/globals.css avec les variables CSS de base pour le thème clair/sombre
12. Vérifie que le projet compile sans erreur avec `npm run build`
```

---

## PROMPT 2 — Base de données Supabase

```
Crée le schéma complet de la base de données Supabase pour LeadFlow CRM.

1. Crée le fichier supabase/migrations/001_initial_schema.sql avec le schéma SQL complet tel que défini dans le CLAUDE.md (tables, RLS policies, indexes)
2. Ajoute des index de performance sur les colonnes fréquemment filtrées :
   - contacts(user_id), contacts(company), contacts(tags)
   - contact_pipeline(contact_id), contact_pipeline(pipeline_id, stage_id)
   - pipeline_stages(pipeline_id, position)
   - ai_enrichments(contact_id, created_at)
3. Crée des fonctions SQL utilitaires :
   - une fonction updated_at trigger pour mettre à jour automatiquement le champ updated_at sur contacts et contact_pipeline
4. Mets à jour lib/supabase/types.ts avec les types TypeScript correspondant à chaque table (utilise le pattern Database générique de Supabase)
5. Crée types/index.ts avec les types métier de l'application (Contact, Pipeline, PipelineStage, ContactPipeline, etc.)
6. Explique comment appliquer la migration sur Supabase (commande CLI ou interface web)
```

---

## PROMPT 3 — Authentification Stytch

```
Implémente l'authentification complète avec Stytch pour LeadFlow CRM.

L'application est à usage solo : une seule personne se connecte.
Méthodes supportées : Magic Link par email + OAuth Google.

1. Crée app/(auth)/login/page.tsx : page de connexion avec
   - Un champ email + bouton "Recevoir un lien de connexion" (Magic Link)
   - Un bouton "Continuer avec Google" (OAuth)
   - Design propre centré, logo/titre de l'app
2. Crée app/(auth)/callback/page.tsx : page de callback qui gère le retour Stytch et redirige vers /contacts
3. Crée un middleware Next.js (middleware.ts à la racine) qui :
   - Vérifie la session Stytch sur toutes les routes (app)
   - Redirige vers /login si pas authentifié
   - Laisse passer les routes /login et /callback
4. Crée app/(app)/layout.tsx avec :
   - Une sidebar fixe à gauche avec navigation : Contacts, Leads (Kanban), Pipelines, Rapports, Paramètres
   - Un header avec le nom de l'app et un bouton de déconnexion
   - Le contenu principal à droite
   - Support mobile avec sidebar rétractable (Sheet de shadcn)
5. Assure-toi que la déconnexion fonctionne et redirige vers /login
6. Teste que la protection des routes fonctionne
```

---

## PROMPT 4 — Module Contacts : liste et CRUD

```
Implémente le module de gestion des contacts complet.

1. Crée le hook hooks/useContacts.ts avec TanStack Query :
   - useContacts() : liste paginée avec filtres (search, tags, company)
   - useContact(id) : fiche unique
   - useCreateContact() : mutation création
   - useUpdateContact() : mutation mise à jour
   - useDeleteContact() : mutation suppression
   - useDeleteContacts() : suppression en masse

2. Crée components/contacts/ContactsTable.tsx avec TanStack Table :
   - Colonnes : avatar+nom, entreprise, email, téléphone, tags, pipeline/statut, date création
   - Tri sur toutes les colonnes
   - Sélection multiple (checkbox)
   - Barre d'actions en masse qui apparaît quand des lignes sont sélectionnées (supprimer, exporter)
   - Pagination (20 contacts par page)

3. Crée components/contacts/ContactFilters.tsx :
   - Champ de recherche globale (nom, email, entreprise)
   - Filtre par tags (multi-select)
   - Filtre par entreprise
   - Bouton reset des filtres

4. Crée components/contacts/ContactForm.tsx avec React Hook Form + Zod :
   - Champs : prénom, nom, email(s), téléphone(s), entreprise, poste, adresse, ville, pays, tags, notes, LinkedIn, Twitter, site web
   - Validation complète avec messages d'erreur en français
   - Mode création et mode édition (même composant)

5. Crée components/contacts/ContactSheet.tsx :
   - Panel latéral (Sheet de shadcn) qui s'ouvre au clic sur un contact
   - Affiche toutes les informations du contact
   - Boutons modifier / supprimer
   - Section "Statut pipeline" avec le statut courant
   - Section "Enrichissement IA" avec le dernier résultat disponible

6. Crée app/(app)/contacts/page.tsx qui assemble tout

7. Crée app/(app)/contacts/[id]/page.tsx : fiche contact complète page entière
```

---

## PROMPT 5 — Import / Export

```
Implémente les fonctionnalités d'import et d'export de contacts.

EXPORT CSV :
1. Crée lib/export/csv.ts avec une fonction exportContactsToCSV(contacts, selectedFields) qui :
   - Accepte un tableau de contacts et une liste de champs à inclure
   - Génère un CSV UTF-8 avec BOM (pour compatibilité Excel)
   - Nomme le fichier contacts_YYYY-MM-DD.csv
2. Crée components/contacts/ExportDialog.tsx :
   - Dialog avec checkboxes pour choisir les colonnes à exporter
   - Option "tous les contacts" ou "sélection actuelle"
   - Bouton de téléchargement

EXPORT VCF :
3. Crée lib/export/vcf.ts avec une fonction exportContactsToVCF(contacts) qui génère un fichier .vcf valide (vCard 3.0) pour un ou plusieurs contacts

IMPORT CSV :
4. Crée lib/import/csv.ts avec :
   - parseCSV(file) : parse le fichier et détecte les colonnes
   - mapCSVToContacts(rows, mapping) : convertit selon le mapping utilisateur
5. Crée components/contacts/ImportCSVDialog.tsx :
   - Upload du fichier CSV
   - Prévisualisation des 5 premières lignes
   - Interface de mapping : colonne CSV → champ contact
   - Gestion des doublons (email identique) : ignorer ou mettre à jour
   - Barre de progression pendant l'import
   - Rapport final (X créés, Y mis à jour, Z erreurs)

IMPORT VCF :
6. Crée lib/import/vcf.ts avec parseVCF(file) supportant vCard 2.1, 3.0 et 4.0
7. Crée components/contacts/ImportVCFDialog.tsx :
   - Upload du fichier .vcf
   - Prévisualisation des contacts détectés
   - Confirmation avant import
   - Même logique de gestion des doublons

8. Intègre les boutons Import et Export dans la page contacts (toolbar au-dessus de la table)
```

---

## PROMPT 6 — Pipelines et vue Kanban

```
Implémente le module de pipelines et la vue Kanban.

GESTION DES PIPELINES :
1. Crée hooks/usePipelines.ts avec TanStack Query (CRUD pipelines et stages)
2. Crée app/(app)/pipelines/page.tsx :
   - Liste des pipelines existants (cartes)
   - Bouton créer un nouveau pipeline
3. Crée components/pipeline/PipelineEditor.tsx :
   - Formulaire de création/édition d'un pipeline
   - Gestion des étapes avec @dnd-kit/sortable pour réordonner par drag & drop
   - Pour chaque étape : nom + sélecteur de couleur
   - Ajout/suppression d'étapes

VUE KANBAN :
4. Crée components/pipeline/KanbanBoard.tsx avec @dnd-kit/core :
   - Colonnes = étapes du pipeline sélectionné
   - Cartes = contacts dans ce pipeline
   - Drag & drop d'une carte entre colonnes
   - Au drop : met à jour contact_pipeline en base + enregistre dans pipeline_history
   - Compteur de contacts par colonne
5. Crée components/pipeline/KanbanCard.tsx :
   - Nom du contact, entreprise, tags
   - Avatar
   - Clic → ouvre ContactSheet
6. Crée app/(app)/leads/page.tsx :
   - Sélecteur de pipeline en haut
   - KanbanBoard pour le pipeline sélectionné
   - Bouton "Ajouter un contact au pipeline" (sélectionne un contact existant)

INTÉGRATION DANS LA FICHE CONTACT :
7. Dans ContactSheet, permets d'assigner un contact à un pipeline et de changer son statut via un select
```

---

## PROMPT 7 — Rapports et analytics

```
Implémente le module de rapports pour LeadFlow CRM.

1. Crée hooks/useReports.ts avec TanStack Query pour les requêtes analytiques :
   - Distribution des contacts par statut de pipeline
   - Évolution des changements de statut sur une période
   - Contacts par tags (top 10)
   - Contacts sans activité depuis N jours
   - Taux de conversion entre étapes consécutives

2. Crée les composants de visualisation avec Recharts :
   - components/reports/DistributionChart.tsx : graphique en barres (contacts par statut)
   - components/reports/PipelineChart.tsx : graphique en camembert (répartition pipeline)
   - components/reports/TimelineChart.tsx : courbe d'évolution temporelle
   - components/reports/ConversionFunnel.tsx : entonnoir de conversion entre étapes

3. Crée components/reports/ReportFilters.tsx :
   - Sélecteur de pipeline
   - Sélecteur de période : 7j, 30j, 90j, personnalisé (date picker)

4. Crée app/(app)/reports/page.tsx :
   - Grille de widgets avec les 4 graphiques
   - Filtres en haut de page
   - Bouton "Exporter en CSV" qui télécharge les données brutes du rapport affiché
   - Design en cartes avec shadcn Card

5. Ajoute des stats résumées en haut de la page (KPIs) :
   - Total contacts
   - Contacts ajoutés ce mois
   - Nombre de pipelines actifs
   - Contacts sans statut assigné
```

---

## PROMPT 8 — Agent IA

```
Implémente l'agent IA d'enrichissement des contacts avec l'API Anthropic.

1. Crée lib/ai/agent.ts avec deux fonctions principales :
   - enrichContactProfile(contact) : recherche des informations sur un contact (poste actuel, publications récentes, profil public)
   - enrichCompanyNews(company: string) : recherche les dernières actualités d'une entreprise (levées de fonds, nominations, communiqués)
   Ces fonctions utilisent @anthropic-ai/sdk avec le modèle claude-sonnet-4-6 et l'outil web_search intégré.
   Le prompt système doit demander un résultat structuré : résumé en français, sources, date de recherche.

2. Crée app/api/ai/enrich/route.ts :
   - POST avec body { contactId, type: 'contact_profile' | 'company_news' }
   - Vérifie la session Stytch
   - Appelle la fonction appropriée de lib/ai/agent.ts
   - Sauvegarde le résultat dans la table ai_enrichments
   - Retourne le résultat
   - Gère les erreurs (quota API, timeout)

3. Crée components/contacts/AIEnrichmentPanel.tsx :
   - Affiché dans la fiche contact (ContactSheet et page [id])
   - Deux boutons : "Actualités entreprise" et "Profil contact"
   - Indicateur de chargement pendant la requête (peut prendre 10-15 secondes)
   - Affichage du résultat en markdown formaté
   - Date de la dernière recherche
   - Historique des 3 derniers enrichissements (accordéon)
   - Bouton pour relancer une nouvelle recherche

4. Assure-toi que la clé ANTHROPIC_API_KEY n'est jamais exposée côté client
5. Ajoute une gestion du rate limiting (max 1 requête toutes les 10 secondes par contact)
```

---

## PROMPT 9 — Intégration Notion

```
Implémente l'intégration Notion unidirectionnelle (CRM → Notion).

OBJECTIF : permettre d'exporter les contacts et leur statut de pipeline vers une base de données Notion existante, pour alimenter un tableau de suivi.

1. Crée lib/notion/sync.ts :
   - connectNotion(token, databaseId) : vérifie la connexion et récupère les propriétés de la BDD Notion
   - getNotionDatabaseSchema(databaseId) : retourne les colonnes disponibles dans la BDD Notion
   - syncContactToNotion(contact, pipelineStatus, config) : crée ou met à jour une page Notion pour ce contact
   - syncAllContacts(contacts, config) : exporte tous les contacts en batch (gère la pagination et le rate limiting Notion)
   Le matching de mise à jour se fait sur l'email du contact.

2. Crée app/api/notion/sync/route.ts :
   - POST : déclenche une synchronisation manuelle complète
   - Vérifie la session Stytch
   - Retourne un rapport { total, created, updated, errors }

3. Crée app/(app)/settings/page.tsx :
   - Section "Intégration Notion" avec :
     - Champ "Token d'intégration Notion" (input password)
     - Champ "ID de la base de données Notion" avec instructions pour le trouver
     - Bouton "Tester la connexion"
     - Interface de mapping : champ contact ↔ propriété Notion (select dynamique basé sur les colonnes détectées)
     - Champs mappables : nom, email, téléphone, entreprise, poste, tags, statut pipeline, notes
     - Sélecteur du pipeline dont le statut sera synchronisé
     - Bouton "Synchroniser maintenant" avec indicateur de progression
     - Date et résultat de la dernière synchronisation
   - Section "Compte" avec bouton de déconnexion

4. Sauvegarde la config dans la table notion_config (sans stocker le token en clair — utilise Supabase Vault ou chiffre avec la service role key)

5. Gère les cas d'erreur :
   - Token invalide
   - Base de données introuvable
   - Propriété Notion incompatible avec le type de données
   - Rate limit Notion (max 3 req/sec)
```

---

## PROMPT 10 — Finitions et polish

```
Finalise l'application LeadFlow CRM avec les éléments manquants.

1. THÈME SOMBRE : Assure-toi que le mode sombre fonctionne partout. Ajoute un toggle thème clair/sombre dans le header (icône soleil/lune).

2. NOTIFICATIONS : Implémente les toasts de feedback pour toutes les actions :
   - Création/modification/suppression de contact → toast succès ou erreur
   - Import terminé → toast avec résumé
   - Export déclenché → toast "Téléchargement en cours"
   - Enrichissement IA terminé → toast
   - Sync Notion terminée → toast avec résumé

3. PAGE D'ACCUEIL : Redirige automatiquement la racine / vers /contacts si connecté, vers /login sinon.

4. ÉTATS VIDES : Crée des états vides cohérents pour :
   - Aucun contact (avec bouton "Ajouter votre premier contact" et bouton import)
   - Aucun pipeline (avec bouton "Créer votre premier pipeline")
   - Aucun résultat de recherche/filtre

5. RACCOURCIS CLAVIER :
   - Cmd/Ctrl+K → ouvre une palette de commandes (cmdk) pour navigation rapide
   - Cmd/Ctrl+N → nouveau contact
   - Echap → ferme les panels/dialogs ouverts

6. MÉTADONNÉES SEO et manifeste PWA :
   - Titre : "LeadFlow CRM"
   - Favicon personnalisé
   - manifest.json pour installation en PWA

7. OPTIMISATIONS PERFORMANCE :
   - Virtualise la liste des contacts si > 100 contacts avec @tanstack/react-virtual
   - Lazy load les pages rapports et settings avec next/dynamic

8. VÉRIFICATION FINALE :
   - Lance npm run build et corrige toutes les erreurs TypeScript
   - Vérifie que toutes les variables d'environnement sont bien dans .env.example
   - Assure-toi qu'aucune clé API n'est exposée dans le code côté client
   - Teste le flux complet : login → créer contact → assigner pipeline → enrichir IA → exporter CSV
```

---

## Conseils pour travailler avec Claude Code

**Sois spécifique sur les erreurs** : si quelque chose ne compile pas, colle l'erreur complète dans Claude Code.

**Valide visuellement** : après chaque prompt, lance `npm run dev` et vérifie dans le navigateur que ça ressemble à ce que tu attends.

**Si Claude Code s'écarte du plan** : rappelle-lui `Relis le CLAUDE.md et respecte les conventions définies.`

**Pour les composants UI** : si le résultat visuel ne te convient pas, dis `Améliore le design de [composant] pour qu'il soit plus moderne et épuré, en restant avec shadcn/ui et Tailwind.`

**Commits réguliers** : fais un `git commit` après chaque prompt réussi pour pouvoir revenir en arrière facilement.
