from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.auth import require_user
from app.db import get_db
from app.integrations.registry import PLATFORM_COLORS, PLATFORM_LABELS
from app.models import Notification, Post, PostStatus, SocialAccount
from app.services import unread_messages_count, unread_notifications_count

router = APIRouter()
from app.templating import templates


@router.get("/")
def dashboard(request: Request, db: Session = Depends(get_db), user=Depends(require_user)):
    accounts_count = db.query(SocialAccount).count()
    since = datetime.utcnow() - timedelta(days=7)
    posts_this_week = db.query(Post).filter(Post.created_at >= since).count()
    upcoming = (
        db.query(Post)
        .filter(Post.status == PostStatus.scheduled, Post.scheduled_at.isnot(None))
        .order_by(Post.scheduled_at)
        .limit(5)
        .all()
    )
    recent_notifications = db.query(Notification).order_by(Notification.created_at.desc()).limit(5).all()

    return templates.TemplateResponse(
        "dashboard.html",
        {
            "request": request,
            "active": "dashboard",
            "accounts_count": accounts_count,
            "posts_this_week": posts_this_week,
            "upcoming": upcoming,
            "recent_notifications": recent_notifications,
            "platform_labels": PLATFORM_LABELS,
            "platform_colors": PLATFORM_COLORS,
            "unread_count": unread_notifications_count(db),
            "unread_messages_count": unread_messages_count(db),
        },
    )
