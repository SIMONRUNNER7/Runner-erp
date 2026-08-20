#!/usr/bin/env bash
# Installation quasi-automatique de Runner Golf Communication sur le serveur.
# À exécuter sur le serveur (pas sur le Mac), depuis n'importe où :
#   bash deploy/install.sh
#
# Ce script demande le mot de passe sudo au moment où il en a besoin (pour créer
# le service et la config nginx) — il ne stocke ni ne transmet aucun mot de passe.

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "=== Installation de Runner Golf Communication ==="
echo "Dossier du projet : $APP_DIR"
echo

# --- 1. Python / environnement virtuel ---
if ! command -v python3 &>/dev/null; then
  echo "Erreur : python3 n'est pas installé."
  echo "Sur Ubuntu/Debian : sudo apt install python3 python3-venv"
  exit 1
fi

cd "$APP_DIR"
if [ ! -d venv ]; then
  echo "Création de l'environnement virtuel..."
  python3 -m venv venv
fi
echo "Installation des dépendances Python..."
./venv/bin/pip install --upgrade pip -q
./venv/bin/pip install -r requirements.txt -q

# --- 2. Fichier .env ---
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Fichier .env créé à partir de .env.example."
fi

if grep -q "SECRET_KEY=change-moi-en-production" .env 2>/dev/null; then
  NEW_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
  sed -i.bak "s/SECRET_KEY=change-moi-en-production/SECRET_KEY=$NEW_SECRET/" .env
  rm -f .env.bak
  echo "Clé secrète de production générée automatiquement."
fi

read -rp "Nom de domaine pour Communication (ex: communication.runner.golf, laisser vide pour configurer plus tard) : " DOMAIN
if [ -n "$DOMAIN" ]; then
  sed -i.bak "s#http://localhost:8000#https://$DOMAIN#g" .env
  sed -i.bak "s#^PUBLIC_BASE_URL=.*#PUBLIC_BASE_URL=https://$DOMAIN#" .env
  rm -f .env.bak
  echo "URLs de redirection mises à jour avec https://$DOMAIN dans .env."
  echo "(Pensez aussi à mettre à jour ces URLs dans chaque app développeur — voir SETUP.md)"
fi

# --- 2b. Secret partagé avec l'ERP (onglet "Communication") ---
# Sans ce secret, l'app fonctionne normalement mais l'onglet de l'ERP demandera
# une connexion séparée au lieu de reconnaître l'utilisateur déjà identifié.
if grep -q "^ERP_SSO_SECRET=$" .env 2>/dev/null; then
  SSO_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
  sed -i.bak "s#^ERP_SSO_SECRET=\$#ERP_SSO_SECRET=$SSO_SECRET#" .env
  rm -f .env.bak
  echo
  echo "--------------------------------------------------------------------"
  echo "Secret de connexion partagé généré. Copiez cette ligne dans le fichier"
  echo ".env de l'ERP, puis redémarrez l'ERP :"
  echo
  echo "  MARKETING_SSO_SECRET=$SSO_SECRET"
  echo "  MARKETING_APP_URL=https://${DOMAIN:-communication.runner.golf}"
  echo "--------------------------------------------------------------------"
  echo
fi

read -rp "Adresse de l'ERP autorisée à afficher Communication (ex: https://erp.runner.golf, Entrée pour garder la valeur du .env) : " ERP_ORIGIN_INPUT
if [ -n "$ERP_ORIGIN_INPUT" ]; then
  sed -i.bak "s#^ERP_ORIGIN=.*#ERP_ORIGIN=$ERP_ORIGIN_INPUT#" .env
  rm -f .env.bak
fi

# --- 3. Service systemd (démarre l'app en permanence) ---
echo
echo "Création du service systemd (mot de passe sudo requis)..."
SERVICE_FILE="/etc/systemd/system/communication.service"
sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=Runner Golf Communication
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$APP_DIR
ExecStart=$APP_DIR/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable communication
sudo systemctl restart communication
sleep 2
if sudo systemctl is-active --quiet communication; then
  echo "Service 'communication' démarré avec succès."
else
  echo "Le service n'a pas démarré correctement — voir : sudo journalctl -u communication -n 50"
fi

# --- 4. nginx (reverse proxy) ---
if command -v nginx &>/dev/null && [ -n "$DOMAIN" ]; then
  echo
  echo "Configuration nginx pour $DOMAIN (mot de passe sudo requis)..."
  NGINX_FILE="/etc/nginx/sites-available/communication"
  sudo tee "$NGINX_FILE" > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
  sudo ln -sf "$NGINX_FILE" /etc/nginx/sites-enabled/communication
  if sudo nginx -t; then
    sudo systemctl reload nginx
    echo "nginx configuré et rechargé."
  else
    echo "Erreur dans la config nginx générée — vérifiez $NGINX_FILE"
  fi

  if command -v certbot &>/dev/null; then
    echo "Activation du HTTPS avec certbot..."
    sudo certbot --nginx -d "$DOMAIN" --agree-tos -m "admin@$DOMAIN" --redirect || \
      echo "certbot n'a pas pu terminer automatiquement — relancez manuellement : sudo certbot --nginx -d $DOMAIN"
  else
    echo "certbot n'est pas installé. Pour le HTTPS :"
    echo "  sudo apt install certbot python3-certbot-nginx"
    echo "  sudo certbot --nginx -d $DOMAIN"
  fi
else
  echo
  echo "nginx non détecté ou domaine non renseigné : configuration du reverse proxy à faire"
  echo "manuellement plus tard (voir DEPLOY.md, section 5)."
fi

echo
echo "=== Terminé ==="
echo "Test local : curl -I http://127.0.0.1:8000/login"
if [ -n "$DOMAIN" ]; then
  echo "Une fois le DNS pointé vers ce serveur : https://$DOMAIN/login"
fi
echo
echo "Dernière étape (sur le serveur de l'ERP, pas ici) : ajoutez MARKETING_APP_URL et"
echo "MARKETING_SSO_SECRET (affichés plus haut) au .env de l'ERP, puis redémarrez-le."
echo "L'onglet \"Communication\" apparaîtra automatiquement pour les rôles président"
echo "et commercial — aucun code à modifier."
