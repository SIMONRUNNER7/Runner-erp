import os
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Form, Request, UploadFile
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.auth import require_admin, require_user
from app.db import get_db
from app.integrations.registry import PLATFORM_COLORS, PLATFORM_LABELS
from app.models import AdCampaign, AdStatSnapshot, CampaignObjective, CampaignStatus, Post, SocialAccount
from app.services import unread_messages_count, unread_notifications_count

router = APIRouter()
from app.templating import templates

UPLOAD_DIR = "data/uploads"
VIDEO_EXT = {".mp4", ".mov", ".webm", ".m4v"}
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp"}

OBJECTIVE_LABELS = {
    CampaignObjective.awareness: "Notoriété",
    CampaignObjective.traffic: "Trafic",
    CampaignObjective.engagement: "Engagement",
    CampaignObjective.leads: "Leads",
    CampaignObjective.conversions: "Conversions",
}


def _latest_totals(campaign: AdCampaign) -> dict:
    totals = {"impressions": 0, "clicks": 0, "spend": 0.0, "conversions": 0}
    for s in campaign.stats:
        totals["impressions"] += s.impressions
        totals["clicks"] += s.clicks
        totals["spend"] += s.spend
        totals["conversions"] += s.conversions
    return totals


@router.get("/ads")
def ads_page(request: Request, db: Session = Depends(get_db), user=Depends(require_user)):
    campaigns = db.query(AdCampaign).order_by(AdCampaign.created_at.desc()).all()
    accounts = db.query(SocialAccount).all()
    campaign_data = [{"campaign": c, "totals": _latest_totals(c)} for c in campaigns]
    grand_total = {"impressions": 0, "clicks": 0, "spend": 0.0, "conversions": 0}
    for d in campaign_data:
        for k in grand_total:
            grand_total[k] += d["totals"][k]

    return templates.TemplateResponse(
        "ads.html",
        {
            "request": request,
            "active": "ads",
            "campaign_data": campaign_data,
            "grand_total": grand_total,
            "accounts": accounts,
            "platform_labels": PLATFORM_LABELS,
            "platform_colors": PLATFORM_COLORS,
            "objective_labels": OBJECTIVE_LABELS,
            "unread_count": unread_notifications_count(db),
            "unread_messages_count": unread_messages_count(db),
        },
    )


@router.get("/ads/new")
def ads_new_page(request: Request, post_id: Optional[int] = None, db: Session = Depends(get_db), user=Depends(require_user)):
    post = db.get(Post, post_id) if post_id else None
    if post:
        boosted_platforms = {t.platform for t in post.targets if t.status.value == "published"}
        accounts = db.query(SocialAccount).filter(SocialAccount.platform.in_(boosted_platforms)).all()
    else:
        accounts = db.query(SocialAccount).all()

    return templates.TemplateResponse(
        "ads_new.html",
        {
            "request": request,
            "active": "ads",
            "accounts": accounts,
            "post": post,
            "platform_labels": PLATFORM_LABELS,
            "objective_labels": OBJECTIVE_LABELS,
            "unread_count": unread_notifications_count(db),
            "unread_messages_count": unread_messages_count(db),
        },
    )


@router.post("/ads/new")
async def ads_create(
    name: str = Form(...),
    account_id: int = Form(...),
    objective: str = Form("awareness"),
    daily_budget: float = Form(10.0),
    post_id: Optional[int] = Form(None),
    creative_caption: str = Form(""),
    media: Optional[UploadFile] = None,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    account = db.get(SocialAccount, account_id)
    if not account:
        return RedirectResponse("/ads?error=Compte+introuvable.", status_code=303)

    try:
        campaign_objective = CampaignObjective(objective)
    except ValueError:
        campaign_objective = CampaignObjective.awareness

    media_path = None
    media_type = None
    if not post_id and media is not None and media.filename:
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        ext = os.path.splitext(media.filename)[1].lower()
        filename = f"{uuid.uuid4().hex}{ext}"
        media_path = os.path.join(UPLOAD_DIR, filename)
        content = await media.read()
        with open(media_path, "wb") as f:
            f.write(content)
        media_type = "video" if ext in VIDEO_EXT else "image" if ext in IMAGE_EXT else None

    campaign = AdCampaign(
        platform=account.platform,
        account_id=account.id,
        post_id=post_id or None,
        name=name.strip() or f"Campagne {PLATFORM_LABELS[account.platform]}",
        objective=campaign_objective,
        daily_budget=max(0.0, daily_budget),
        status=CampaignStatus.draft,
        simulated=account.simulated,
        start_date=datetime.utcnow(),
        creative_caption=None if post_id else creative_caption.strip(),
        media_path=media_path,
        media_type=media_type,
    )
    db.add(campaign)
    db.commit()

    msg = "Boost+créé+en+brouillon" if post_id else "Campagne+créée+en+brouillon"
    return RedirectResponse(
        f"/ads?success={msg}.+Activez-la+explicitement+quand+vous+êtes+prêt+à+dépenser.",
        status_code=303,
    )


@router.post("/ads/{campaign_id}/activate")
def ads_activate(campaign_id: int, confirm_spend: str = Form(...), db: Session = Depends(get_db), user=Depends(require_admin)):
    campaign = db.get(AdCampaign, campaign_id)
    if not campaign:
        return RedirectResponse("/ads?error=Campagne+introuvable.", status_code=303)
    if confirm_spend != "yes":
        return RedirectResponse("/ads?error=Confirmation+de+dépense+requise+pour+activer+une+campagne.", status_code=303)

    if not campaign.simulated:
        return RedirectResponse(
            "/ads?error=Activation+réelle+non+disponible+:+finalisez+la+campagne+directement+dans+le+gestionnaire+de+pub+natif+(Meta+Ads+Manager,+etc.)+pour+engager+un+vrai+budget.",
            status_code=303,
        )

    campaign.status = CampaignStatus.active
    db.commit()
    return RedirectResponse("/ads?success=Campagne+activée+(mode+démo).", status_code=303)


@router.post("/ads/{campaign_id}/pause")
def ads_pause(campaign_id: int, db: Session = Depends(get_db), user=Depends(require_user)):
    campaign = db.get(AdCampaign, campaign_id)
    if campaign:
        campaign.status = CampaignStatus.paused
        db.commit()
    return RedirectResponse("/ads?success=Campagne+mise+en+pause.", status_code=303)


@router.post("/ads/{campaign_id}/delete")
def ads_delete(campaign_id: int, db: Session = Depends(get_db), user=Depends(require_user)):
    campaign = db.get(AdCampaign, campaign_id)
    if campaign:
        db.delete(campaign)
        db.commit()
    return RedirectResponse("/ads?success=Campagne+supprimée.", status_code=303)
