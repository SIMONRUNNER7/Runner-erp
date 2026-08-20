import calendar as pycal
from collections import defaultdict
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.auth import require_user
from app.db import get_db
from app.integrations.registry import PLATFORM_COLORS, PLATFORM_LABELS
from app.models import EditorialEvent, EditorialEventType, Post, PostStatus
from app.services import unread_messages_count, unread_notifications_count
from app.timezones import parse_app_local_datetime, utc_to_app_local

router = APIRouter()
from app.templating import templates

MOIS_FR = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
]
JOURS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]

EVENT_TYPE_META = {
    EditorialEventType.tournage: {"label": "Tournage vidéo", "icon": "🎥", "color": "#7c3aed"},
    EditorialEventType.photo: {"label": "Séance photo", "icon": "📷", "color": "#ea580c"},
    EditorialEventType.presse: {"label": "Parution presse/magazine", "icon": "📰", "color": "#0369a1"},
    EditorialEventType.evenement: {"label": "Événement/salon", "icon": "🎪", "color": "#0d9488"},
}


@router.get("/calendar")
def calendar_page(request: Request, year: int = None, month: int = None, db: Session = Depends(get_db), user=Depends(require_user)):
    today_local = utc_to_app_local(datetime.utcnow()).date()
    year = year or today_local.year
    month = month or today_local.month

    cal = pycal.Calendar(firstweekday=0)  # lundi
    weeks = cal.monthdatescalendar(year, month)  # liste de semaines, chaque semaine = 7 dates
    grid_start = weeks[0][0]
    grid_end = weeks[-1][-1]

    posts = db.query(Post).filter(Post.status != PostStatus.draft).all()
    by_day = defaultdict(list)
    for post in posts:
        ref_dt = post.scheduled_at or post.created_at
        local_date = utc_to_app_local(ref_dt).date()
        if grid_start <= local_date <= grid_end:
            by_day[local_date].append({"kind": "post", "obj": post, "time": ref_dt})

    events = db.query(EditorialEvent).all()
    for event in events:
        local_date = utc_to_app_local(event.event_date).date()
        if grid_start <= local_date <= grid_end:
            by_day[local_date].append({"kind": "event", "obj": event, "time": event.event_date})

    for day_items in by_day.values():
        day_items.sort(key=lambda item: item["time"])

    weeks_data = [
        [
            {
                "date": d,
                "in_month": d.month == month,
                "is_today": d == today_local,
                "entries": by_day.get(d, []),
            }
            for d in week
        ]
        for week in weeks
    ]

    prev_month = (date(year, month, 1) - timedelta(days=1))
    next_month = (date(year, month, 28) + timedelta(days=7)).replace(day=1)

    return templates.TemplateResponse(
        "calendar.html",
        {
            "request": request,
            "active": "calendar",
            "weeks": weeks_data,
            "month_label": f"{MOIS_FR[month - 1]} {year}",
            "jours_fr": JOURS_FR,
            "prev_year": prev_month.year,
            "prev_month": prev_month.month,
            "next_year": next_month.year,
            "next_month": next_month.month,
            "today_year": today_local.year,
            "today_month": today_local.month,
            "platform_labels": PLATFORM_LABELS,
            "platform_colors": PLATFORM_COLORS,
            "event_types": EVENT_TYPE_META,
            "unread_count": unread_notifications_count(db),
            "unread_messages_count": unread_messages_count(db),
        },
    )


@router.post("/calendar/events/new")
def create_event(
    title: str = Form(...),
    event_type: str = Form(...),
    event_date: str = Form(...),
    notes: str = Form(""),
    year: int = Form(...),
    month: int = Form(...),
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    try:
        etype = EditorialEventType(event_type)
    except ValueError:
        etype = EditorialEventType.evenement

    event_dt = parse_app_local_datetime(event_date) if event_date else None
    if not event_dt:
        return RedirectResponse(f"/calendar?year={year}&month={month}&error=Date+invalide.", status_code=303)

    db.add(
        EditorialEvent(
            title=title.strip(),
            event_type=etype,
            event_date=event_dt,
            notes=notes.strip() or None,
            created_by=user.id,
        )
    )
    db.commit()
    return RedirectResponse(f"/calendar?year={year}&month={month}&success=Événement+ajouté.", status_code=303)


@router.post("/calendar/events/{event_id}/delete")
def delete_event(event_id: int, year: int = Form(...), month: int = Form(...), db: Session = Depends(get_db), user=Depends(require_user)):
    event = db.get(EditorialEvent, event_id)
    if event:
        db.delete(event)
        db.commit()
    return RedirectResponse(f"/calendar?year={year}&month={month}&success=Événement+supprimé.", status_code=303)
