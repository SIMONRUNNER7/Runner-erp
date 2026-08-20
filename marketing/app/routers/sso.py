"""Connexion automatique depuis l'ERP (onglet « Communication »).

L'ERP signe un jeton JWT de très courte durée avec un secret partagé
(MARKETING_SSO_SECRET côté ERP == ERP_SSO_SECRET ici), puis ouvre
`/sso?token=...`. On vérifie le jeton, on retrouve ou crée le compte
Communication correspondant à l'email ERP, et on pose le cookie de session.

L'utilisateur n'a donc rien à saisir : une seule connexion, celle de l'ERP.
Le formulaire de connexion classique (/login) reste disponible pour les
personnes qui n'ont pas de compte ERP.
"""

import secrets

import jwt
from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.auth import hash_password, set_session_cookie
from app.config import get_settings
from app.db import get_db
from app.models import User, UserRole
from app.templating import templates

router = APIRouter()
settings = get_settings()

# Le jeton n'est qu'un ticket d'entrée à usage immédiat : l'ERP le génère au
# moment où l'utilisateur ouvre l'onglet, il ne doit pas rester valable ensuite.
TOKEN_AUDIENCE = "communication"
TOKEN_ALGORITHM = "HS256"

# Correspondance rôles ERP -> rôles Communication.
# Seuls les rôles listés ici ont accès à l'onglet ; les autres (production,
# achats, comptable) reçoivent un refus explicite plutôt qu'un compte silencieux.
ERP_ROLE_MAPPING = {
    "president": UserRole.admin,
    "commercial": UserRole.editor,
    "marketing": UserRole.admin,
}


def _error(request: Request, message: str, status_code: int = 403):
    return templates.TemplateResponse(
        "sso_error.html",
        {"request": request, "message": message},
        status_code=status_code,
    )


@router.get("/sso")
def sso_login(request: Request, token: str = "", db: Session = Depends(get_db)):
    if not settings.erp_sso_secret:
        return _error(
            request,
            "La connexion depuis l'ERP n'est pas configurée sur ce serveur "
            "(ERP_SSO_SECRET manquant dans le fichier .env).",
            status_code=503,
        )
    if not token:
        return _error(request, "Jeton de connexion manquant.", status_code=400)

    try:
        payload = jwt.decode(
            token,
            settings.erp_sso_secret,
            algorithms=[TOKEN_ALGORITHM],
            audience=TOKEN_AUDIENCE,
        )
    except jwt.ExpiredSignatureError:
        return _error(
            request,
            "Ce lien de connexion a expiré. Revenez à l'ERP et rouvrez l'onglet Communication.",
            status_code=401,
        )
    except jwt.InvalidTokenError:
        return _error(request, "Jeton de connexion invalide.", status_code=401)

    email = (payload.get("email") or "").lower().strip()
    if not email:
        return _error(request, "Le jeton ne contient pas d'adresse email.", status_code=400)

    erp_role = (payload.get("role") or "").strip()
    role = ERP_ROLE_MAPPING.get(erp_role)
    if role is None:
        return _error(
            request,
            f"Votre rôle dans l'ERP ({erp_role or 'inconnu'}) n'a pas accès à Communication. "
            "Demandez au président de vous donner le rôle commercial ou marketing.",
        )

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        # Mot de passe aléatoire jamais communiqué : ce compte se connecte
        # uniquement via l'ERP. La personne peut s'en définir un depuis
        # « Mon compte » si elle veut aussi passer par /login.
        user = User(
            email=email,
            name=(payload.get("name") or email.split("@")[0]).strip(),
            password_hash=hash_password(secrets.token_urlsafe(32)),
            role=role,
        )
        db.add(user)
    else:
        # L'ERP fait autorité sur le rôle et le nom : un changement côté ERP
        # se répercute à la connexion suivante.
        user.role = role
        if payload.get("name"):
            user.name = payload["name"].strip()

    db.commit()
    db.refresh(user)

    response = RedirectResponse("/?embed=1", status_code=303)
    set_session_cookie(response, user.id)
    return response
