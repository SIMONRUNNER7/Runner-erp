from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from app.auth import AuthRequiredError, ForbiddenError
from app.config import get_settings
from app.db import Base, engine
from app.migrate import run_additive_migrations
from app.routers import (
    account_settings,
    accounts,
    ads,
    auth_router,
    calendar,
    dashboard,
    inbox,
    media,
    notifications_router,
    posts,
    recommendations_router,
    sso,
    stats,
    team,
)
from app.scheduler import start_scheduler

settings = get_settings()

UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    run_additive_migrations()
    start_scheduler()
    yield


app = FastAPI(title="Runner Golf Communication", lifespan=lifespan)
app.mount("/static", StaticFiles(directory="app/static"), name="static")
app.mount("/uploads", StaticFiles(directory="data/uploads"), name="uploads")


@app.middleware("http")
async def require_same_origin(request: Request, call_next):
    """Protection CSRF.

    Le cookie de session passe en SameSite=None en production pour fonctionner
    dans l'iframe de l'ERP — le navigateur ne filtre donc plus les requêtes
    venant d'autres sites. On vérifie ici que toute requête modifiant des
    données provient bien de cette application.

    Les pages affichées dans l'iframe sont servies par CE domaine : leurs
    formulaires envoient donc notre propre origine, pas celle de l'ERP.
    """
    if request.method in UNSAFE_METHODS and settings.public_base_url:
        origin = request.headers.get("origin")
        if origin is None:
            referer = request.headers.get("referer") or ""
            origin = "/".join(referer.split("/")[:3]) if referer else None
        if origin is not None and origin != settings.public_base_url:
            return JSONResponse({"detail": "Origine non autorisée."}, status_code=403)

    response = await call_next(request)

    # Autorise uniquement l'ERP à embarquer l'app en iframe (et refuse tout le
    # reste). Sans en-tête, n'importe quel site pourrait l'encadrer.
    frame_ancestors = f"'self' {settings.erp_origin}".strip() if settings.erp_origin else "'self'"
    response.headers["Content-Security-Policy"] = f"frame-ancestors {frame_ancestors}"
    return response


@app.exception_handler(AuthRequiredError)
async def auth_required_handler(request: Request, exc: AuthRequiredError):
    return RedirectResponse("/login", status_code=303)


@app.exception_handler(ForbiddenError)
async def forbidden_handler(request: Request, exc: ForbiddenError):
    return RedirectResponse("/?error=Action+réservée+aux+administrateurs.", status_code=303)


app.include_router(auth_router.router)
app.include_router(sso.router)
app.include_router(dashboard.router)
app.include_router(accounts.router)
app.include_router(posts.router)
app.include_router(stats.router)
app.include_router(recommendations_router.router)
app.include_router(notifications_router.router)
app.include_router(inbox.router)
app.include_router(ads.router)
app.include_router(calendar.router)
app.include_router(media.router)
app.include_router(team.router)
app.include_router(account_settings.router)
