from datetime import datetime

from apscheduler.schedulers.background import BackgroundScheduler

from app.db import SessionLocal
from app.models import AdCampaign, CampaignStatus, Post, PostStatus, PostTarget, TargetStatus
from app.recommendations import generate_upcoming_notifications
from app.services import publish_target, sync_ad_campaign_stats, sync_stats

scheduler = BackgroundScheduler(timezone="UTC")


def job_publish_due_posts():
    """Publie chaque cible (post x plateforme) à son propre horaire : une même
    publication peut ainsi sortir à des heures différentes selon le réseau
    (PostTarget.scheduled_at prime sur Post.scheduled_at s'il est renseigné)."""
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        pending_targets = (
            db.query(PostTarget)
            .join(Post)
            .filter(PostTarget.status == TargetStatus.pending, Post.status == PostStatus.scheduled)
            .all()
        )
        touched_posts = set()
        for target in pending_targets:
            effective_time = target.scheduled_at or target.post.scheduled_at
            if effective_time and effective_time <= now:
                publish_target(db, target)
                touched_posts.add(target.post)

        for post in touched_posts:
            if all(t.status != TargetStatus.pending for t in post.targets):
                post.status = (
                    PostStatus.published
                    if all(t.status == TargetStatus.published for t in post.targets)
                    else PostStatus.failed
                )
        db.commit()
    finally:
        db.close()


def job_sync_stats():
    db = SessionLocal()
    try:
        targets = db.query(PostTarget).filter(PostTarget.status == TargetStatus.published).all()
        for target in targets:
            sync_stats(db, target)
    finally:
        db.close()


def job_generate_notifications():
    db = SessionLocal()
    try:
        generate_upcoming_notifications(db)
    finally:
        db.close()


def job_sync_ads():
    db = SessionLocal()
    try:
        campaigns = db.query(AdCampaign).filter(AdCampaign.status == CampaignStatus.active).all()
        for campaign in campaigns:
            sync_ad_campaign_stats(db, campaign)
    finally:
        db.close()


def start_scheduler():
    if scheduler.running:
        return
    scheduler.add_job(job_publish_due_posts, "interval", seconds=60, id="publish_due_posts", replace_existing=True)
    scheduler.add_job(job_sync_stats, "interval", minutes=15, id="sync_stats", replace_existing=True)
    scheduler.add_job(job_generate_notifications, "interval", hours=6, id="generate_notifications", replace_existing=True)
    scheduler.add_job(job_sync_ads, "interval", minutes=30, id="sync_ads", replace_existing=True)
    scheduler.start()
    # Exécute une première passe immédiatement au démarrage
    job_generate_notifications()
