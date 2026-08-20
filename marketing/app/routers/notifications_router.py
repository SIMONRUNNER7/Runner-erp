from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.auth import require_user
from app.db import get_db
from app.integrations.registry import PLATFORM_COLORS, PLATFORM_LABELS
from app.models import Notification
from app.services import unread_messages_count, unread_notifications_count

router = APIRouter()
from app.templating import templates


@router.get("/notifications")
def notifications_page(request: Request, db: Session = Depends(get_db), user=Depends(require_user)):
    notifications = db.query(Notification).order_by(Notification.created_at.desc()).limit(100).all()
    return templates.TemplateResponse(
        "notifications.html",
        {
            "request": request,
            "active": "notifications",
            "notifications": notifications,
            "platform_labels": PLATFORM_LABELS,
            "platform_colors": PLATFORM_COLORS,
            "unread_count": unread_notifications_count(db),
            "unread_messages_count": unread_messages_count(db),
        },
    )


@router.post("/notifications/mark-all-read")
def mark_all_read(db: Session = Depends(get_db), user=Depends(require_user)):
    db.query(Notification).filter(Notification.read.is_(False)).update({Notification.read: True})
    db.commit()
    return RedirectResponse("/notifications", status_code=303)
