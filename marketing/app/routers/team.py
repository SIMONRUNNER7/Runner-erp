import secrets

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.auth import hash_password, require_admin
from app.db import get_db
from app.models import User, UserRole
from app.services import unread_messages_count, unread_notifications_count

router = APIRouter()
from app.templating import templates


@router.get("/team")
def team_page(request: Request, db: Session = Depends(get_db), user=Depends(require_admin)):
    members = db.query(User).order_by(User.created_at).all()
    return templates.TemplateResponse(
        "team.html",
        {
            "request": request,
            "active": "team",
            "members": members,
            "unread_count": unread_notifications_count(db),
            "unread_messages_count": unread_messages_count(db),
        },
    )


@router.post("/team/new")
def team_new(
    name: str = Form(...),
    email: str = Form(...),
    role: str = Form("editor"),
    db: Session = Depends(get_db),
    user=Depends(require_admin),
):
    email = email.lower().strip()
    if db.query(User).filter(User.email == email).first():
        return RedirectResponse("/team?error=Un+compte+existe+déjà+avec+cet+email.", status_code=303)

    try:
        member_role = UserRole(role)
    except ValueError:
        member_role = UserRole.editor

    temp_password = secrets.token_urlsafe(9)
    member = User(name=name.strip(), email=email, password_hash=hash_password(temp_password), role=member_role)
    db.add(member)
    db.commit()
    return RedirectResponse(
        f"/team?success=Compte+créé+pour+{name.strip()}+·+mot+de+passe+temporaire+:+{temp_password}+(à+transmettre+et+changer+à+la+première+connexion).",
        status_code=303,
    )


@router.post("/team/{member_id}/role")
def team_update_role(member_id: int, role: str = Form(...), db: Session = Depends(get_db), user=Depends(require_admin)):
    member = db.get(User, member_id)
    if not member:
        return RedirectResponse("/team?error=Membre+introuvable.", status_code=303)
    try:
        member.role = UserRole(role)
    except ValueError:
        return RedirectResponse("/team?error=Rôle+invalide.", status_code=303)
    if member.id == user.id and member.role != UserRole.admin:
        return RedirectResponse("/team?error=Vous+ne+pouvez+pas+retirer+vos+propres+droits+admin.", status_code=303)
    db.commit()
    return RedirectResponse("/team?success=Rôle+mis+à+jour.", status_code=303)


@router.post("/team/{member_id}/delete")
def team_delete(member_id: int, db: Session = Depends(get_db), user=Depends(require_admin)):
    if member_id == user.id:
        return RedirectResponse("/team?error=Vous+ne+pouvez+pas+supprimer+votre+propre+compte.", status_code=303)
    member = db.get(User, member_id)
    if member:
        db.delete(member)
        db.commit()
    return RedirectResponse("/team?success=Membre+supprimé.", status_code=303)
