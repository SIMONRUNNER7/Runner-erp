from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.auth import COOKIE_NAME, get_current_user, hash_password, set_session_cookie, verify_password
from app.db import get_db
from app.models import User

router = APIRouter()
from app.templating import templates


@router.get("/login")
def login_page(request: Request, db: Session = Depends(get_db)):
    if get_current_user(request, db):
        return RedirectResponse("/", status_code=303)
    allow_register = db.query(User).count() == 0
    return templates.TemplateResponse(
        "login.html", {"request": request, "allow_register": allow_register, "error": None}
    )


@router.post("/login")
def login_submit(
    request: Request,
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == email.lower().strip()).first()
    if not user or not verify_password(password, user.password_hash):
        allow_register = db.query(User).count() == 0
        return templates.TemplateResponse(
            "login.html",
            {"request": request, "allow_register": allow_register, "error": "Email ou mot de passe incorrect."},
            status_code=401,
        )
    response = RedirectResponse("/", status_code=303)
    set_session_cookie(response, user.id)
    return response


@router.get("/register")
def register_page(request: Request, db: Session = Depends(get_db)):
    if db.query(User).count() > 0:
        return RedirectResponse("/login", status_code=303)
    return templates.TemplateResponse("register.html", {"request": request, "error": None})


@router.post("/register")
def register_submit(
    request: Request,
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    if db.query(User).count() > 0:
        return RedirectResponse("/login", status_code=303)
    if len(password) < 8:
        return templates.TemplateResponse(
            "register.html",
            {"request": request, "error": "Le mot de passe doit contenir au moins 8 caractères."},
            status_code=400,
        )
    user = User(name=name.strip(), email=email.lower().strip(), password_hash=hash_password(password))
    db.add(user)
    db.commit()
    response = RedirectResponse("/", status_code=303)
    set_session_cookie(response, user.id)
    return response


@router.get("/logout")
def logout():
    response = RedirectResponse("/login", status_code=303)
    response.delete_cookie(COOKIE_NAME)
    return response
