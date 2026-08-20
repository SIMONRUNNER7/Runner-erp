from fastapi.templating import Jinja2Templates

from app.timezones import format_local, localize_slot_label


def _global_context(request):
    from app.auth import get_current_user
    from app.db import SessionLocal
    from app.models import UserRole

    db = SessionLocal()
    try:
        user = get_current_user(request, db)
        return {
            "current_user": user,
            "is_admin": bool(user and user.role == UserRole.admin),
        }
    finally:
        db.close()


templates = Jinja2Templates(directory="app/templates", context_processors=[_global_context])
templates.env.filters["local"] = format_local
templates.env.filters["localize_slot"] = localize_slot_label
