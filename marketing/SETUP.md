# Guide de configuration des API — Runner Golf Social

Ce guide explique comment obtenir les accès développeur pour chacune des 5 plateformes.
Tant qu'une plateforme n'est pas configurée, l'app fonctionne pour elle en **mode démo**
(publications et statistiques simulées) — vous pouvez donc utiliser tout le produit dès
maintenant et brancher les vraies API une par une, à votre rythme.

Une fois les clés obtenues, ajoutez-les dans le fichier `.env` à la racine du projet
(copié depuis `.env.example`) puis redémarrez le serveur. Sur la page **Comptes**, la
plateforme passera automatiquement de "API non configurée" à "API configurée" et le
bouton "Connecter (OAuth réel)" apparaîtra.

---

## Matrice de capacités réelles par plateforme

Toutes les fonctionnalités sont utilisables dès maintenant **en mode démo**. Voici ce qui
sera réellement branchable une fois les clés API configurées, et ce qui restera
structurellement impossible (limite imposée par la plateforme elle-même, pas par l'app) :

| Fonctionnalité | YouTube | TikTok | Instagram | Facebook | LinkedIn |
|---|---|---|---|---|---|
| Publication fil d'actualité | ✅ | ✅ | ✅ | ✅ | ✅ |
| Stories | ❌ (supprimé par YouTube en 2023) | ❌ (pas d'API publique) | ✅ | ✅ | ❌ (aucun concept de story) |
| Statistiques de publication | ✅ | ✅ | ✅ | ✅ | ✅ (limité) |
| Messagerie privée (inbox) | ❌ (pas de DM) | ❌ (pas d'API publique) | ✅ (nécessite webhook, voir note) | ✅ (nécessite webhook, voir note) | ❌ (API partenaire fermée) |
| Publicités | ✅ (via Google Ads, pas la même API) | ✅ (TikTok Ads API) | ✅ (Meta Marketing API) | ✅ (Meta Marketing API) | ✅ (accès partenaire à demander) |

**Sur la messagerie :** contrairement à la publication (simple clé API + OAuth), une
inbox en temps réel nécessite un **serveur avec une URL publique HTTPS** que Meta peut
appeler (webhook) — impossible tant que l'app tourne uniquement en local sur votre Mac.
C'est une étape "Phase 2", à faire une fois l'app hébergée en ligne.

**Sur les publicités :** ce sont des comptes et API entièrement séparés de la
publication organique, avec leur propre moyen de paiement (à configurer par vous
directement dans Meta Ads Manager / TikTok Ads Manager / etc.). L'app peut piloter les
campagnes une fois le compte pub relié, mais ne peut jamais engager de dépense réelle
sans une confirmation explicite de votre part dans l'interface.

---

## 1. YouTube (Google)

**Où :** [console.cloud.google.com](https://console.cloud.google.com)

1. Créez un projet Google Cloud.
2. Dans "API et services > Bibliothèque", activez **YouTube Data API v3**.
3. Dans "API et services > Écran de consentement OAuth" :
   - Type : Externe.
   - Renseignez le nom de l'app, logo Runner Golf, email de contact.
   - Ajoutez les scopes `youtube.upload` et `youtube.readonly`.
   - Tant que l'app n'est pas "publiée" (validée par Google), seuls les comptes Google
     que vous ajoutez comme "utilisateurs de test" pourront se connecter — suffisant
     pour un usage interne à Runner Golf.
4. Dans "Identifiants", créez un **ID client OAuth 2.0** de type "Application Web".
   - URI de redirection autorisé : `http://localhost:8000/accounts/youtube/callback`
     (remplacez `localhost:8000` par votre domaine une fois hébergé en ligne).
5. Copiez le **Client ID** et le **Client Secret** dans `.env` :
   ```
   YOUTUBE_CLIENT_ID=...
   YOUTUBE_CLIENT_SECRET=...
   YOUTUBE_REDIRECT_URI=http://localhost:8000/accounts/youtube/callback
   ```

**Délai :** immédiat en mode test, quelques jours si vous demandez la validation Google
pour un usage public au-delà de 100 utilisateurs (non nécessaire pour votre équipe).

---

## 2. TikTok

**Où :** [developers.tiktok.com](https://developers.tiktok.com)

1. Créez un compte développeur puis une **App**.
2. Ajoutez le produit **"Content Posting API"** (nécessite une demande d'accès —
   TikTok review manuellement chaque usage de publication automatique, comptez
   quelques jours à 2 semaines).
3. Renseignez l'URL de redirection : `http://localhost:8000/accounts/tiktok/callback`
4. Une fois l'app approuvée, récupérez la **Client Key** et le **Client Secret** :
   ```
   TIKTOK_CLIENT_KEY=...
   TIKTOK_CLIENT_SECRET=...
   TIKTOK_REDIRECT_URI=http://localhost:8000/accounts/tiktok/callback
   ```

**Important :** en attendant l'approbation, la publication TikTok reste en mode démo.

---

## 3. Instagram + Facebook (Meta)

Les deux passent par la même app Meta puisqu'Instagram Business est géré via une Page
Facebook liée.

**Où :** [developers.facebook.com](https://developers.facebook.com)

1. Créez une App de type **"Business"**.
2. Ajoutez les produits **"Facebook Login"** et **"Instagram Graph API"**.
3. Dans les paramètres de "Facebook Login", ajoutez l'URI de redirection :
   `http://localhost:8000/accounts/meta/callback`
4. **Avant de demander la validation officielle**, ajoutez-vous comme testeur/admin :
   Rôles de l'app → Ajouter des personnes → ajoutez le(s) compte(s) Facebook de
   l'équipe Runner Golf en tant qu'**Administrateur** ou **Testeur**. Tant que
   Communication reste en mode "Développement" et que seuls des comptes ayant un
   rôle sur l'app se connectent (le vôtre, celui de Simon...), l'API fonctionne
   **immédiatement, sans attendre de validation** — la validation Meta ("App Review")
   n'est obligatoire que pour ouvrir l'app à des comptes extérieurs à votre équipe,
   ce qui n'est pas votre cas pour un outil interne. Essayez de connecter le compte
   directement après cette étape ; ce n'est que si une permission bloque que la
   demande d'App Review (1 à 3 semaines) devient nécessaire.
5. Permissions à activer (en mode Standard, utilisables par les testeurs sans
   review) : `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`,
   `instagram_basic`, `instagram_content_publish`, `read_insights`.
6. Pré-requis côté Runner Golf : la page Facebook doit être liée à un compte
   **Instagram Business ou Creator** (Paramètres Instagram > Compte > Passer à un
   compte professionnel, puis lier la page dans les paramètres de la page Facebook).
7. Récupérez l'**App ID** et l'**App Secret** :
   ```
   META_APP_ID=...
   META_APP_SECRET=...
   META_REDIRECT_URI=http://localhost:8000/accounts/meta/callback
   ```

**Note technique :** l'API Instagram exige que l'image/vidéo à publier soit accessible
via une URL publique (pas un simple fichier local). Une fois l'app hébergée en ligne,
ce sera automatiquement le cas pour les médias uploadés dans le composer.

---

## 4. LinkedIn

**Où :** [developer.linkedin.com](https://developer.linkedin.com)

1. Créez une App, associée à votre Page LinkedIn Runner Golf.
2. Demandez le produit **"Share on LinkedIn"** (et **"Community Management API"**
   si vous publiez au nom d'une page entreprise plutôt qu'un profil personnel).
3. Ajoutez l'URI de redirection : `http://localhost:8000/accounts/linkedin/callback`
4. Récupérez le **Client ID** et le **Client Secret** :
   ```
   LINKEDIN_CLIENT_ID=...
   LINKEDIN_CLIENT_SECRET=...
   LINKEDIN_REDIRECT_URI=http://localhost:8000/accounts/linkedin/callback
   ```

**Délai :** généralement approuvé rapidement (quelques jours) pour "Share on LinkedIn".

---

## Une fois hébergé en ligne

Remplacez chaque `http://localhost:8000` par votre domaine réel (ex :
`https://social.runner.golf`) à la fois :
- dans `.env` (les `*_REDIRECT_URI`)
- dans la configuration de chaque app développeur (Google/TikTok/Meta/LinkedIn)

Les deux doivent correspondre exactement, sinon la connexion OAuth échouera.

---

## Intégration dans l'ERP (onglet "Communication")

**C'est fait.** L'onglet est désormais intégré nativement dans l'ERP, avec connexion
automatique (SSO) : une personne connectée à l'ERP ouvre l'onglet « Communication » et
arrive directement dans l'application, sans second mot de passe.

Le détail technique est décrit dans [INTEGRATION.md](INTEGRATION.md). En résumé :

- L'onglet apparaît automatiquement dans le menu de l'ERP pour les rôles **président** et
  **commercial** — aucun code à copier-coller.
- L'ERP signe un jeton de connexion valable 60 secondes que Communication vérifie grâce à
  un secret partagé (`MARKETING_SSO_SECRET` côté ERP == `ERP_SSO_SECRET` ici).
- Le compte Communication est créé automatiquement à la première ouverture, avec le rôle
  déduit du rôle ERP (président → admin, commercial → editor).
- Le problème de cookies tiers en iframe est réglé : le cookie de session passe en
  `SameSite=None; Secure` en production, avec une vérification d'origine pour compenser la
  protection CSRF que le navigateur n'assure plus.

La page « Équipe » reste utile pour créer des comptes à des personnes **sans compte ERP**,
qui se connecteront alors par `/login`.

## Démarrer le serveur

Le serveur démarre automatiquement à chaque login grâce au launch agent macOS
`~/Library/LaunchAgents/golf.runner.social.plist` (il redémarre aussi tout seul en
cas de plantage). Pour le piloter manuellement :

```bash
# Arrêter
launchctl unload ~/Library/LaunchAgents/golf.runner.social.plist

# Démarrer / redémarrer
launchctl load -w ~/Library/LaunchAgents/golf.runner.social.plist

# Voir les logs
tail -f ~/RunnerGolfSocial/data/server.log
```

Le projet vit désormais dans `~/RunnerGolfSocial` (et non plus sur le Bureau) car
macOS restreint l'accès des processus en arrière-plan aux dossiers Bureau/Documents/
Téléchargements.
