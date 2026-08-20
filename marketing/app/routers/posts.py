import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Body, Depends, Form, Request, UploadFile
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.auth import require_user
from app.db import get_db
from app.integrations.registry import PLATFORM_LABELS
from app.models import STORY_CAPABLE_PLATFORMS, MediaAsset, Post, PostStatus, PostTarget, PostType, SocialAccount, TargetStatus
from app.optimization import boost_suggestions, score_post
from app.recommendations import best_times_by_platform
from app.routers.media import save_upload_to_library
from app.services import publish_target, unread_messages_count, unread_notifications_count
from app.timezones import next_occurrence_app_local, parse_app_local_datetime
from app.writing_assistant import CAPTION_TEMPLATES, get_inspiration

router = APIRouter()
from app.templating import templates


def _parse_tags(raw: str) -> list:
    return [t.strip() for t in raw.replace("\n", ",").split(",") if t.strip()]


@router.get("/composer")
def composer_page(
    request: Request,
    duplicate: Optional[int] = None,
    post_type: Optional[str] = None,
    media_asset_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    accounts = db.query(SocialAccount).order_by(SocialAccount.platform).all()
    prefill = None
    if duplicate:
        source = db.get(Post, duplicate)
        if source:
            prefill = {
                "caption": source.caption,
                "post_type": post_type or source.post_type.value,
                "options": source.options,
                "account_ids": [t.account_id for t in source.targets],
            }

    selected_asset = db.get(MediaAsset, media_asset_id) if media_asset_id else None
    recent_assets = db.query(MediaAsset).order_by(MediaAsset.created_at.desc()).limit(8).all()

    best_times = best_times_by_platform(db)
    suggested_times = {
        platform.value: [
            {"label": label, "iso": next_occurrence_app_local(wd, hour).isoformat(timespec="minutes")}
            for (wd, hour), label in zip(info["slots"][:2], info["labels"][:2])
        ]
        for platform, info in best_times.items()
    }

    return templates.TemplateResponse(
        "composer.html",
        {
            "request": request,
            "active": "composer",
            "accounts": accounts,
            "platform_labels": PLATFORM_LABELS,
            "story_capable": [p.value for p in STORY_CAPABLE_PLATFORMS],
            "prefill": prefill,
            "selected_asset": selected_asset,
            "recent_assets": recent_assets,
            "suggested_times": suggested_times,
            "caption_templates": CAPTION_TEMPLATES,
            "inspiration": get_inspiration(db),
            "unread_count": unread_notifications_count(db),
            "unread_messages_count": unread_messages_count(db),
        },
    )


@router.post("/composer/score")
def composer_score(payload: dict = Body(...), db: Session = Depends(get_db), user=Depends(require_user)):
    account_ids = payload.get("account_ids") or []
    caption = payload.get("caption") or ""
    media_type = payload.get("media_type")
    post_type_raw = payload.get("post_type") or "feed"
    scheduled_at_raw = payload.get("scheduled_at")
    options = payload.get("options") or {}

    try:
        post_type = PostType(post_type_raw)
    except ValueError:
        post_type = PostType.feed

    scheduled_dt = parse_app_local_datetime(scheduled_at_raw) if scheduled_at_raw else None

    accounts = db.query(SocialAccount).filter(SocialAccount.id.in_(account_ids)).all()
    best_times = best_times_by_platform(db)

    results = []
    for account in accounts:
        slots = best_times.get(account.platform, {}).get("slots", [])
        result = score_post(caption, media_type, account.platform, post_type, scheduled_dt, slots, options)
        results.append(
            {
                "platform": account.platform.value,
                "label": PLATFORM_LABELS[account.platform],
                "score": result["score"],
                "tips": result["tips"],
            }
        )
    return {"results": results}


@router.post("/composer")
async def composer_submit(
    request: Request,
    caption: str = Form(""),
    post_type: str = Form("feed"),
    scheduled_at: str = Form(""),
    per_platform_times: str = Form(""),
    account_ids: list = Form([]),
    hashtags: str = Form(""),
    mentions: str = Form(""),
    location: str = Form(""),
    alt_text: str = Form(""),
    first_comment: str = Form(""),
    link_url: str = Form(""),
    visibility: str = Form("public"),
    media_asset_id: str = Form(""),
    media: Optional[UploadFile] = None,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    account_ids = [int(a) for a in account_ids]
    if not account_ids:
        return RedirectResponse("/composer?error=Sélectionnez+au+moins+un+compte.", status_code=303)

    try:
        ptype = PostType(post_type)
    except ValueError:
        ptype = PostType.feed

    accounts = db.query(SocialAccount).filter(SocialAccount.id.in_(account_ids)).all()
    skipped = []
    if ptype == PostType.story:
        valid_accounts = [a for a in accounts if a.platform in STORY_CAPABLE_PLATFORMS]
        skipped = [a for a in accounts if a.platform not in STORY_CAPABLE_PLATFORMS]
        accounts = valid_accounts
    if not accounts:
        return RedirectResponse(
            "/composer?error=Aucun+compte+sélectionné+ne+supporte+les+stories.", status_code=303
        )

    media_path = None
    media_type = None
    if media is not None and media.filename:
        content = await media.read()
        asset = save_upload_to_library(content, media.filename, user.id, db)
        media_path, media_type = asset.path, asset.media_type
    elif media_asset_id:
        asset = db.get(MediaAsset, int(media_asset_id))
        if asset:
            media_path, media_type = asset.path, asset.media_type

    scheduled_dt = parse_app_local_datetime(scheduled_at) if scheduled_at else None

    use_per_platform = per_platform_times == "1"
    target_times_raw = {}
    if use_per_platform:
        form = await request.form()
        try:
            target_times_raw = json.loads(form.get("target_times_json", "{}") or "{}")
        except ValueError:
            target_times_raw = {}

    post = Post(
        caption=caption,
        media_path=media_path,
        media_type=media_type,
        post_type=ptype,
        status=PostStatus.draft,
        created_by=user.id,
    )
    post.options = {
        "hashtags": _parse_tags(hashtags),
        "mentions": _parse_tags(mentions),
        "location": location.strip(),
        "alt_text": alt_text.strip(),
        "first_comment": first_comment.strip(),
        "link_url": link_url.strip(),
        "visibility": visibility,
    }
    db.add(post)
    db.flush()

    targets = []
    for account in accounts:
        target_dt = None
        if use_per_platform:
            raw = target_times_raw.get(str(account.id))
            if raw:
                target_dt = parse_app_local_datetime(raw)
        target = PostTarget(
            post_id=post.id,
            account_id=account.id,
            platform=account.platform,
            status=TargetStatus.pending,
            scheduled_at=target_dt,
        )
        db.add(target)
        targets.append(target)
    db.commit()

    now = datetime.utcnow()

    def effective_time(t):
        return t.scheduled_at or scheduled_dt

    immediate = [t for t in targets if not effective_time(t) or effective_time(t) <= now]
    future = [t for t in targets if effective_time(t) and effective_time(t) > now]

    if immediate:
        post.status = PostStatus.publishing
        db.commit()
        for t in immediate:
            publish_target(db, t)

    skip_note = ""
    if skipped:
        names = ", ".join(PLATFORM_LABELS[a.platform] for a in skipped)
        skip_note = f"+(ignoré+pour+{names}+:+stories+non+supportées)"

    if future:
        post.scheduled_at = min(effective_time(t) for t in future)
        post.status = PostStatus.scheduled
        db.commit()
        return RedirectResponse(
            f"/posts?success=Publication+planifiée.{skip_note}",
            status_code=303,
        )

    post.status = PostStatus.published if all(t.status == TargetStatus.published for t in post.targets) else PostStatus.failed
    db.commit()
    return RedirectResponse(f"/posts?success=Publication+envoyée.{skip_note}", status_code=303)


@router.get("/posts")
def posts_list(request: Request, db: Session = Depends(get_db), user=Depends(require_user)):
    posts = db.query(Post).order_by(Post.created_at.desc()).all()
    all_accounts = db.query(SocialAccount).all()
    suggestions_by_post = {
        post.id: boost_suggestions(post, all_accounts, PLATFORM_LABELS)
        for post in posts
        if post.status == PostStatus.published
    }
    return templates.TemplateResponse(
        "posts.html",
        {
            "request": request,
            "active": "posts",
            "posts": posts,
            "platform_labels": PLATFORM_LABELS,
            "suggestions_by_post": suggestions_by_post,
            "unread_count": unread_notifications_count(db),
            "unread_messages_count": unread_messages_count(db),
        },
    )


@router.post("/posts/{post_id}/publish-now")
def publish_now(post_id: int, db: Session = Depends(get_db), user=Depends(require_user)):
    post = db.get(Post, post_id)
    if not post:
        return RedirectResponse("/posts?error=Post+introuvable.", status_code=303)
    post.status = PostStatus.publishing
    db.commit()
    for target in post.targets:
        if target.status in (TargetStatus.pending, TargetStatus.failed):
            publish_target(db, target)
    post.status = PostStatus.published if all(t.status == TargetStatus.published for t in post.targets) else PostStatus.failed
    db.commit()
    return RedirectResponse("/posts?success=Publication+envoyée.", status_code=303)


@router.post("/posts/{post_id}/delete")
def delete_post(post_id: int, db: Session = Depends(get_db), user=Depends(require_user)):
    post = db.get(Post, post_id)
    if post:
        db.delete(post)
        db.commit()
    return RedirectResponse("/posts?success=Publication+supprimée.", status_code=303)
