import secrets
from typing import Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.auth import require_admin, require_user
from app.db import get_db
from app.integrations.registry import PLATFORM_LABELS, get_adapter
from app.models import Platform, SocialAccount
from app.services import unread_messages_count, unread_notifications_count

router = APIRouter()
from app.templating import templates

# Regroupe les plateformes qui partagent un même flow OAuth (Meta = Instagram + Facebook)
CALLBACK_GROUP = {
    Platform.instagram: "meta",
    Platform.facebook: "meta",
    Platform.youtube: "youtube",
    Platform.tiktok: "tiktok",
    Platform.linkedin: "linkedin",
}

_pending_states: dict[str, Platform] = {}


@router.get("/accounts")
def accounts_page(request: Request, db: Session = Depends(get_db), user=Depends(require_user)):
    accounts = db.query(SocialAccount).order_by(SocialAccount.platform).all()
    by_platform = {p: [] for p in Platform}
    for acc in accounts:
        by_platform[acc.platform].append(acc)
    platforms = [
        {
            "key": p.value,
            "label": PLATFORM_LABELS[p],
            "configured": get_adapter(p).is_configured,
            "accounts": by_platform[p],
        }
        for p in Platform
    ]
    return templates.TemplateResponse(
        "accounts.html",
        {
            "request": request,
            "active": "accounts",
            "platforms": platforms,
            "unread_count": unread_notifications_count(db),
            "unread_messages_count": unread_messages_count(db),
        },
    )


@router.get("/accounts/{platform}/connect")
def connect(platform: Platform, db: Session = Depends(get_db), user=Depends(require_admin)):
    adapter = get_adapter(platform)
    if not adapter.is_configured:
        return RedirectResponse(
            f"/accounts?error=Configuration+API+manquante+pour+{PLATFORM_LABELS[platform]}.+Voir+SETUP.md,+ou+utilisez+le+mode+démo.",
            status_code=303,
        )
    state = secrets.token_urlsafe(16)
    _pending_states[state] = platform
    return RedirectResponse(adapter.get_auth_url(state), status_code=303)


@router.post("/accounts/{platform}/connect-demo")
def connect_demo(platform: Platform, db: Session = Depends(get_db), user=Depends(require_admin)):
    count = db.query(SocialAccount).filter(SocialAccount.platform == platform).count()
    account = SocialAccount(
        platform=platform,
        account_name=f"Runner Golf {PLATFORM_LABELS[platform]} (démo){'' if count == 0 else ' ' + str(count + 1)}",
        external_id=f"demo-{platform.value}-{count + 1}",
        connected=True,
        simulated=True,
    )
    db.add(account)
    db.commit()
    return RedirectResponse(f"/accounts?success=Compte+{PLATFORM_LABELS[platform]}+connecté+en+mode+démo.", status_code=303)


@router.get("/accounts/{group}/callback")
def oauth_callback(group: str, request: Request, code: Optional[str] = None, state: Optional[str] = None, db: Session = Depends(get_db), user=Depends(require_admin)):
    platform = _pending_states.pop(state, None) if state else None
    if platform is None:
        # retrouve la plateforme via le groupe si le state a été perdu (ex: redémarrage serveur)
        for p, g in CALLBACK_GROUP.items():
            if g == group:
                platform = p
                break
    if not code or platform is None:
        return RedirectResponse("/accounts?error=Connexion+annulée+ou+invalide.", status_code=303)

    adapter = get_adapter(platform)
    try:
        data = adapter.exchange_code(code)
    except Exception as exc:  # noqa: BLE001
        return RedirectResponse(f"/accounts?error=Échec+de+connexion+:+{exc}", status_code=303)

    account = SocialAccount(
        platform=platform,
        account_name=data.get("account_name", PLATFORM_LABELS[platform]),
        external_id=data.get("external_id"),
        access_token=data.get("access_token"),
        refresh_token=data.get("refresh_token"),
        connected=True,
        simulated=False,
    )
    db.add(account)
    db.commit()
    return RedirectResponse(f"/accounts?success=Compte+{PLATFORM_LABELS[platform]}+connecté.", status_code=303)


@router.post("/accounts/{account_id}/disconnect")
def disconnect(account_id: int, db: Session = Depends(get_db), user=Depends(require_admin)):
    account = db.get(SocialAccount, account_id)
    if account:
        db.delete(account)
        db.commit()
    return RedirectResponse("/accounts?success=Compte+déconnecté.", status_code=303)
