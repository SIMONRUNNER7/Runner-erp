from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.auth import hash_password, require_user, verify_password
from app.db import get_db
from app.services import unread_messages_count, unread_notifications_count

router = APIRouter()
from app.templating import templates


@router.get("/account")
def account_page(request: Request, db: Session = Depends(get_db), user=Depends(require_user)):
    return templates.TemplateResponse(
        "account.html",
        {
            "request": request,
            "active": "account",
            "unread_count": unread_notifications_count(db),
            "unread_messages_count": unread_messages_count(db),
        },
    )


@router.post("/account/password")
def change_password(
    current_password: str = Form(...),
    new_password: str = Form(...),
    confirm_password: str = Form(...),
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    if not verify_password(current_password, user.password_hash):
        return RedirectResponse("/account?error=Mot+de+passe+actuel+incorrect.", status_code=303)
    if len(new_password) < 8:
        return RedirectResponse("/account?error=Le+nouveau+mot+de+passe+doit+faire+au+moins+8+caractères.", status_code=303)
    if new_password != confirm_password:
        return RedirectResponse("/account?error=Les+deux+mots+de+passe+ne+correspondent+pas.", status_code=303)

    user.password_hash = hash_password(new_password)
    db.commit()
    return RedirectResponse("/account?success=Mot+de+passe+mis+à+jour.", status_code=303)
