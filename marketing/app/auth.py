import hashlib
import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, Request
from itsdangerous import BadSignature, URLSafeTimedSerializer
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import User, UserRole


class AuthRequiredError(Exception):
    pass


class ForbiddenError(Exception):
    pass

settings = get_settings()
serializer = URLSafeTimedSerializer(settings.secret_key, salt="session")

COOKIE_NAME = "session"
SESSION_MAX_AGE = 60 * 60 * 24 * 30  # 30 jours


def hash_password(password: str) -> str:
    salt = os.urandom(16).hex()
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 260_000).hex()
    return f"{salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, digest = stored.split("$")
    except ValueError:
        return False
    check = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 260_000).hex()
    return check == digest


def create_session_value(user_id: int) -> str:
    return serializer.dumps({"user_id": user_id})


def read_session_value(value: str):
    try:
        return serializer.loads(value, max_age=SESSION_MAX_AGE)
    except BadSignature:
        return None


def cookie_samesite() -> str:
    """Un cookie SameSite=Lax n'est pas envoyé quand l'app est affichée en iframe
    depuis un autre site. En production (HTTPS) on passe donc en SameSite=None,
    ce qui exige Secure=True — et impose la vérification d'origine ci-dessous
    (voir require_same_origin dans main.py) pour ne pas ouvrir de faille CSRF."""
    return "none" if settings.is_https else "lax"


def set_session_cookie(response, user_id: int) -> None:
    response.set_cookie(
        COOKIE_NAME,
        create_session_value(user_id),
        httponly=True,
        samesite=cookie_samesite(),
        secure=settings.is_https,
        max_age=SESSION_MAX_AGE,
    )


def get_current_user(request: Request, db: Session = Depends(get_db)) -> Optional[User]:
    raw = request.cookies.get(COOKIE_NAME)
    if not raw:
        return None
    data = read_session_value(raw)
    if not data:
        return None
    return db.get(User, data.get("user_id"))


def require_user(request: Request, db: Session = Depends(get_db)) -> User:
    user = get_current_user(request, db)
    if not user:
        raise AuthRequiredError()
    return user


def require_admin(request: Request, db: Session = Depends(get_db)) -> User:
    user = require_user(request, db)
    if user.role != UserRole.admin:
        raise ForbiddenError()
    return user
