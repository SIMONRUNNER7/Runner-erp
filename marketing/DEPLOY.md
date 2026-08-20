# Déployer Communication sur le VPS existant (aux côtés de l'ERP)

Objectif : **un seul serveur, une seule facture d'hébergement**, deux applications qui
cohabitent sans être fusionnées. Communication tourne comme un service indépendant, jamais
exposé directement à Internet ; un reverse proxy (nginx, probablement déjà en place devant
l'ERP) route les visiteurs vers l'une ou l'autre application. **Aucune modification du code
ou de la base de données de l'ERP existant n'est nécessaire.**

Je n'ai pas accès à ce VPS depuis ici — ce guide est à suivre par la personne qui a l'accès
SSH (Simon, ou quelqu'un qu'il autorise). Je peux accompagner à distance si vous partagez
les résultats de chaque étape (mais jamais de mot de passe ou de clé privée en clair).

---

## Vue d'ensemble de l'architecture

```
Internet → nginx (port 80/443, déjà en place)
             ├── erp.runnergolf.com          → ERP existant (inchangé)
             └── communication.runnergolf.com → Communication (nouveau, port interne 8000)
```

Le port 8000 de Communication ne doit **jamais** être ouvert au public — seul nginx y accède,
en local sur le serveur.

---

## ⚡ Démarrage rapide (recommandé)

Un script automatise presque tout ce qui suit (venv, dépendances, clé secrète, service qui
tourne en permanence, config nginx, HTTPS). Il ne reste que 3 étapes manuelles :

1. **Copier le projet sur le serveur** (dézipper l'archive transmise, ou `rsync`/`git clone`)
   dans un dossier, ex. `/opt/communication`.
2. **Lancer le script**, depuis le dossier du projet sur le serveur :
   ```bash
   bash deploy/install.sh
   ```
   Il demande le nom de domaine souhaité (ex. `communication.runnergolf.com`) et le mot de
   passe `sudo` au moment où il en a besoin — il ne stocke ni ne transmet rien.
3. **Ajouter le pointage DNS** (chez votre registrar/gestionnaire de domaine) : un
   enregistrement A pointant `communication.runnergolf.com` vers l'IP du serveur — c'est la
   seule étape que le script ne peut pas faire à votre place.

Ensuite, pour activer l'onglet dans l'ERP : le script affiche un secret de connexion
partagé à recopier dans le `.env` de l'ERP (avec l'URL de Communication), puis redémarrez
l'ERP. L'onglet apparaît tout seul — aucun code à modifier. Voir
[INTEGRATION.md](INTEGRATION.md).

Le détail de chaque étape (utile en cas de problème, ou si vous préférez tout faire à la
main) est décrit ci-dessous.

---

---

## Prérequis côté serveur

- Accès SSH avec droits `sudo`
- Python 3.9 ou plus récent (`python3 --version`)
- nginx déjà en place devant l'ERP (`nginx -v`) — si c'est Apache ou Caddy, le principe est
  identique mais la syntaxe de configuration change (dites-le moi, j'adapterai les étapes)
- Un sous-domaine à créer, ex. `communication.runnergolf.com` (ou un chemin sur le domaine
  existant, voir option B plus bas)

---

## 1. Copier le projet sur le serveur

Depuis votre Mac, ou via un dépôt git privé si vous en utilisez un pour l'ERP :

```bash
# Exemple par rsync depuis le Mac (à adapter avec l'IP/le nom du serveur)
rsync -avz --exclude venv --exclude data/runnergolf.db /Users/hugo/RunnerGolfSocial/ \
  utilisateur@votre-serveur:/opt/communication/
```

## 2. Installer l'environnement Python sur le serveur

```bash
cd /opt/communication
python3 -m venv venv
./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt
```

## 3. Configurer `.env` pour la production

```bash
cp .env.example .env
nano .env   # ou l'éditeur de votre choix
```

Points importants à changer avant toute mise en ligne :

- **`SECRET_KEY`** : actuellement `change-moi-en-production` dans le projet — c'est une
  valeur de test, à remplacer par une vraie valeur aléatoire avant le déploiement :
  ```bash
  python3 -c "import secrets; print(secrets.token_hex(32))"
  ```
- **`DATABASE_URL`** : SQLite (valeur par défaut) convient très bien pour une petite équipe.
  Pas besoin de passer à Postgres pour démarrer.
- Les `*_REDIRECT_URI` des réseaux sociaux : à mettre à jour avec le vrai domaine une fois
  connu (voir SETUP.md) — inutile de les changer avant, tant que ces comptes ne sont pas
  encore connectés en OAuth réel.

## 4. Créer un service systemd (garde l'app en marche en permanence)

Créer `/etc/systemd/system/communication.service` :

```ini
[Unit]
Description=Runner Golf Communication
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/communication
ExecStart=/opt/communication/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Puis :

```bash
sudo systemctl daemon-reload
sudo systemctl enable communication
sudo systemctl start communication
sudo systemctl status communication   # doit afficher "active (running)"
```

## 5. Configurer nginx

### Option A — sous-domaine dédié (recommandé)

Créer `/etc/nginx/sites-available/communication` :

```nginx
server {
    listen 80;
    server_name communication.runnergolf.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/communication /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### Option B — chemin sur le domaine existant (ex. erp.runnergolf.com/communication/)

Ajoutez ce bloc **dans le fichier nginx existant de l'ERP**, sans toucher au reste :

```nginx
location /communication/ {
    proxy_pass http://127.0.0.1:8000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

L'option A (sous-domaine) est plus simple et évite des soucis de chemins relatifs dans
l'app — à privilégier si possible.

## 6. DNS (si option A)

Chez votre registrar/gestionnaire DNS, ajoutez un enregistrement pointant vers l'IP du
serveur :

```
communication.runnergolf.com.   A   <IP du VPS>
```

## 7. HTTPS avec Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx   # si pas déjà installé
sudo certbot --nginx -d communication.runnergolf.com
```

Certbot configure automatiquement le certificat et le renouvellement.

## 8. Vérifier

```bash
curl -I https://communication.runnergolf.com/login
```

Doit renvoyer `200 OK`. Ouvrez ensuite l'URL dans un navigateur pour vous connecter.

---

## Une fois en ligne

1. Mettez à jour les `*_REDIRECT_URI` dans `.env` avec le vrai domaine, et dans chaque app
   développeur (Google/Meta/TikTok/LinkedIn) — voir [SETUP.md](SETUP.md).
2. Dans le `.env` de l'ERP, renseignez `MARKETING_APP_URL` et `MARKETING_SSO_SECRET`
   (affichés par `install.sh`), puis redémarrez l'ERP — l'onglet "Communication"
   apparaîtra pour les rôles président et commercial. Voir [INTEGRATION.md](INTEGRATION.md).
3. Pour mettre à jour l'app après un déploiement : `rsync` le code modifié, puis
   `sudo systemctl restart communication`.

## Sécurité

- Ne jamais committer `.env` dans un dépôt git partagé (il contient des secrets une fois
  les clés API renseignées).
- Le port 8000 ne doit être accessible qu'en local sur le serveur (`127.0.0.1:8000` dans
  la config uvicorn/systemd ci-dessus le garantit déjà).
- Sauvegardez régulièrement `data/runnergolf.db` (publications, statistiques, comptes
  connectés) **et `data/uploads/`** (photos et vidéos) — un simple `cp` vers un stockage
  externe suffit pour une petite structure. La base contient les jetons OAuth des réseaux
  sociaux en clair : traitez-la comme un fichier sensible.
- `PUBLIC_BASE_URL` doit être renseigné en production : Instagram télécharge les médias
  depuis cette adresse, et c'est elle qui déclenche les cookies sécurisés.
