from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.auth import require_user
from app.db import get_db
from app.integrations.registry import PLATFORM_LABELS
from app.recommendations import best_times_by_platform, content_insights
from app.services import unread_messages_count, unread_notifications_count

router = APIRouter()
from app.templating import templates


@router.get("/recommendations")
def recommendations_page(request: Request, db: Session = Depends(get_db), user=Depends(require_user)):
    best_times = best_times_by_platform(db)
    insights = content_insights(db)
    return templates.TemplateResponse(
        "recommendations.html",
        {
            "request": request,
            "active": "recommendations",
            "best_times": best_times,
            "platform_labels": PLATFORM_LABELS,
            "insights": insights,
            "unread_count": unread_notifications_count(db),
            "unread_messages_count": unread_messages_count(db),
        },
    )
