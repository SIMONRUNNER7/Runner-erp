# Intégration de Communication dans l'ERP

Ce document décrit **ce qui a été câblé** entre l'ERP et l'application Communication
(développée par Hugo). Pour le déploiement du serveur lui-même, voir
[DEPLOY.md](DEPLOY.md) ; pour les clés API des réseaux sociaux, voir [SETUP.md](SETUP.md).

## Principe

Les deux applications restent des services séparés — l'ERP en Node/TypeScript avec
PostgreSQL, Communication en Python avec SQLite. Elles ne partagent ni code ni base de
données. Ce qu'elles partagent, c'est **un secret et une identité** : l'ERP sait prouver
à Communication qui est l'utilisateur connecté.

```
Navigateur                ERP (Node)                     Communication (Python)
    │                         │                                    │
    ├─ ouvre l'onglet ───────►│                                    │
    │                         ├─ signe un jeton (60 s)             │
    │◄─ URL /sso?token=… ─────┤                                    │
    ├─ charge l'iframe ──────────────────────────────────────────► │
    │                                          vérifie le jeton ───┤
    │◄──────────── cookie de session + tableau de bord ────────────┤
```

L'utilisateur ne saisit **aucun second mot de passe**.

## Ce qui a été ajouté

### Côté ERP

| Fichier | Rôle |
|---|---|
| `backend/src/controllers/marketing.controller.ts` | Émet le jeton SSO (HS256, valable 60 s, audience `communication`) |
| `backend/src/routes/marketing.routes.ts` | `GET /api/marketing/status` et `GET /api/marketing/sso-url` |
| `frontend/src/pages/Communication.tsx` | Page de l'onglet : iframe + boutons « Recharger » / « Plein écran » |
| `frontend/src/components/Sidebar.tsx` | Entrée de menu « Communication » |

Le jeton ne transporte que l'email, le nom et le rôle. Il expire en une minute et ne
sert qu'à **ouvrir la session** — jamais à autoriser un appel d'API.

### Côté Communication

| Fichier | Rôle |
|---|---|
| `app/routers/sso.py` | Vérifie le jeton, crée/retrouve le compte, pose le cookie |
| `app/media_urls.py` | Convertit un média local en URL publique (requis par Instagram) |
| `app/main.py` | En-tête `frame-ancestors` + vérification d'origine (CSRF) |
| `app/config.py` | `PUBLIC_BASE_URL`, `ERP_SSO_SECRET`, `ERP_ORIGIN` |

## Correspondance des rôles

L'ERP a cinq rôles, Communication en a deux. Seuls les rôles ci-dessous voient l'onglet ;
les autres reçoivent un refus explicite plutôt qu'un compte créé silencieusement.

| Rôle ERP | Rôle Communication | Ce que ça permet |
|---|---|---|
| `president` | `admin` | Tout, y compris comptes connectés, publicités et gestion d'équipe |
| `commercial` | `editor` | Créer/planifier des publications, répondre aux messages |
| `production`, `achats`, `comptable` | — | Pas d'accès à l'onglet |

**L'ERP fait autorité** : un changement de rôle ou de nom dans l'ERP est répercuté dans
Communication à la connexion suivante.

Pour donner l'accès à quelqu'un qui n'est ni président ni commercial, deux options :
lui attribuer le rôle `commercial` dans l'ERP, ou ajouter un rôle `marketing` à
l'énumération Prisma (`backend/prisma/schema.prisma`) — la correspondance est déjà
prévue côté Communication (`ERP_ROLE_MAPPING` dans `app/routers/sso.py`) et il suffirait
de l'ajouter à `MARKETING_ROLES` dans le contrôleur ERP.

## Configuration à renseigner

Le secret doit être **strictement identique** des deux côtés.

Dans le `.env` de l'ERP :

```
MARKETING_APP_URL=https://communication.runner.golf
MARKETING_SSO_SECRET=<le même secret>
```

Dans `marketing/.env` :

```
PUBLIC_BASE_URL=https://communication.runner.golf
ERP_SSO_SECRET=<le même secret>
ERP_ORIGIN=https://erp.runner.golf
```

`deploy/install.sh` génère le secret automatiquement et l'affiche à l'écran : il ne reste
qu'à le recopier dans le `.env` de l'ERP.

Tant que `MARKETING_APP_URL` est vide, l'onglet affiche un message « pas encore déployée »
au lieu d'une erreur — l'ERP fonctionne normalement sans Communication.

## Points de sécurité

- **Cookie en iframe.** Un cookie `SameSite=Lax` n'est pas transmis dans une iframe
  hébergée sur un autre domaine. En production (HTTPS) le cookie passe donc en
  `SameSite=None; Secure`.
- **CSRF.** `SameSite=None` supprime la protection que le navigateur assurait, et l'app
  n'avait pas de jetons anti-CSRF. Un contrôle d'origine sur toutes les requêtes
  modifiant des données (`require_same_origin` dans `app/main.py`) prend le relais.
- **Iframe.** L'en-tête `Content-Security-Policy: frame-ancestors` n'autorise que l'ERP à
  encadrer l'application.
- **Secrets.** Ni `.env` ni la base SQLite ne sont versionnés (voir `.gitignore`). La base
  contient les jetons OAuth des réseaux sociaux **en clair** — sauvegardez-la, mais
  traitez-la comme un fichier sensible.

## Sauvegardes

Deux choses à sauvegarder régulièrement sur le serveur, hors du dépôt git :

```
marketing/data/runnergolf.db   # publications, stats, comptes connectés
marketing/data/uploads/        # photos et vidéos
```

## Limite connue

Le planificateur de publications (APScheduler) tourne **dans le processus de
l'application**. Le service systemd démarre volontairement un seul processus uvicorn :
n'ajoutez pas `--workers N`, chaque worker republierait les mêmes publications.
