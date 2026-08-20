import json
from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.auth import require_user
from app.db import get_db
from app.integrations.registry import PLATFORM_LABELS
from app.models import Platform, PostTarget, StatSnapshot, TargetStatus
from app.recommendations import top_performing_posts
from app.services import unread_messages_count, unread_notifications_count

router = APIRouter()
from app.templating import templates


def _latest_snapshots(db: Session):
    targets = db.query(PostTarget).filter(PostTarget.status == TargetStatus.published).all()
    out = []
    for t in targets:
        snap = (
            db.query(StatSnapshot)
            .filter(StatSnapshot.target_id == t.id)
            .order_by(StatSnapshot.captured_at.desc())
            .first()
        )
        if snap:
            out.append((t, snap))
    return out


@router.get("/stats")
def stats_page(request: Request, db: Session = Depends(get_db), user=Depends(require_user)):
    samples = _latest_snapshots(db)

    totals = {"views": 0, "likes": 0, "comments": 0, "shares": 0}
    per_platform = {p: {"views": 0, "likes": 0, "comments": 0, "shares": 0, "posts": 0} for p in Platform}

    for target, snap in samples:
        totals["views"] += snap.views
        totals["likes"] += snap.likes
        totals["comments"] += snap.comments
        totals["shares"] += snap.shares
        pp = per_platform[target.platform]
        pp["views"] += snap.views
        pp["likes"] += snap.likes
        pp["comments"] += snap.comments
        pp["shares"] += snap.shares
        pp["posts"] += 1

    avg_engagement = round(sum(s.engagement_rate for _, s in samples) / len(samples), 2) if samples else 0.0

    # Série temporelle : vues cumulées par jour sur les 14 derniers jours (par plateforme)
    since = datetime.utcnow() - timedelta(days=14)
    daily = defaultdict(lambda: defaultdict(int))
    day_keys = [(since + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(15)]
    for target, snap in samples:
        day = snap.captured_at.strftime("%Y-%m-%d")
        if day in day_keys:
            daily[day][target.platform.value] += snap.views

    chart_data = {
        "labels": day_keys,
        "datasets": [
            {
                "label": PLATFORM_LABELS[p],
                "data": [daily[d].get(p.value, 0) for d in day_keys],
            }
            for p in Platform
        ],
    }

    top_posts = top_performing_posts(db, limit=5)

    return templates.TemplateResponse(
        "stats.html",
        {
            "request": request,
            "active": "stats",
            "totals": totals,
            "avg_engagement": avg_engagement,
            "per_platform": per_platform,
            "platform_labels": PLATFORM_LABELS,
            "chart_data": json.dumps(chart_data),
            "top_posts": top_posts,
            "has_data": len(samples) > 0,
            "unread_count": unread_notifications_count(db),
            "unread_messages_count": unread_messages_count(db),
        },
    )
