import random
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.integrations.base import PublishResult, StatsResult
from app.integrations.registry import PLATFORM_LABELS, get_adapter
from app.models import Conversation, Notification, NotificationType, PostTarget, StatSnapshot, TargetStatus


def unread_notifications_count(db: Session) -> int:
    return db.query(Notification).filter(Notification.read.is_(False)).count()


def unread_messages_count(db: Session) -> int:
    return db.query(Conversation).filter(Conversation.unread.is_(True)).count()


def publish_target(db: Session, target: PostTarget) -> None:
    """Publie une cible (post x compte) sur sa plateforme.

    Si le compte est en mode simulation (pas encore de vraies clés API
    configurées et validées), on simule une publication réussie afin que
    tout le reste du produit (planification, stats, recommandations) soit
    utilisable dès maintenant.
    """
    account = target.account
    post = target.post
    target.status = TargetStatus.publishing
    db.commit()

    adapter = get_adapter(target.platform)

    if account.simulated or not adapter.is_configured:
        result = PublishResult(True, external_post_id=f"sim-{target.id}-{int(datetime.utcnow().timestamp())}")
    else:
        result = adapter.publish(account, post)

    if result.success:
        target.status = TargetStatus.published
        target.external_post_id = result.external_post_id
        target.published_at = datetime.utcnow()
        db.add(
            Notification(
                type=NotificationType.publish_success,
                title=f"Publié sur {PLATFORM_LABELS[target.platform]}",
                message=f"Le post #{post.id} a été publié avec succès sur {PLATFORM_LABELS[target.platform]}.",
                platform=target.platform,
            )
        )
    else:
        target.status = TargetStatus.failed
        target.error_message = result.error_message
        db.add(
            Notification(
                type=NotificationType.publish_error,
                title=f"Échec sur {PLATFORM_LABELS[target.platform]}",
                message=f"La publication du post #{post.id} a échoué : {result.error_message}",
                platform=target.platform,
            )
        )
    db.commit()


def sync_stats(db: Session, target: PostTarget) -> None:
    account = target.account
    adapter = get_adapter(target.platform)

    if account.simulated or not adapter.is_configured:
        stats = _simulate_stats(target)
    else:
        stats = adapter.fetch_stats(account, target)

    snapshot = StatSnapshot(
        target_id=target.id,
        views=stats.views,
        likes=stats.likes,
        comments=stats.comments,
        shares=stats.shares,
        engagement_rate=stats.engagement_rate,
    )
    db.add(snapshot)
    db.commit()


def sync_ad_campaign_stats(db: Session, campaign) -> None:
    from app.models import AdStatSnapshot

    if campaign.simulated:
        daily_budget = max(1.0, campaign.daily_budget)
        impressions = int(daily_budget * random.uniform(150, 400))
        clicks = int(impressions * random.uniform(0.01, 0.04))
        spend = round(daily_budget * random.uniform(0.85, 1.0), 2)
        conversions = int(clicks * random.uniform(0.02, 0.1))
    else:
        # Intégration réelle (Meta/TikTok/LinkedIn/Google Ads Marketing API) à brancher ici
        # une fois le compte publicitaire configuré — voir SETUP.md.
        impressions = clicks = conversions = 0
        spend = 0.0

    db.add(
        AdStatSnapshot(
            campaign_id=campaign.id,
            impressions=impressions,
            clicks=clicks,
            spend=spend,
            conversions=conversions,
        )
    )
    db.commit()


def _simulate_stats(target: PostTarget) -> StatsResult:
    """Génère des statistiques fictives croissantes et réalistes pour la démo,
    tant que les vraies API ne sont pas branchées."""
    hours_since_publish = 1
    if target.published_at:
        hours_since_publish = max(1, int((datetime.utcnow() - target.published_at).total_seconds() // 3600) + 1)

    base_reach = {
        "youtube": 400,
        "tiktok": 900,
        "instagram": 600,
        "facebook": 300,
        "linkedin": 150,
    }.get(target.platform.value, 300)

    growth = min(hours_since_publish, 48)
    views = int(base_reach * growth * random.uniform(0.8, 1.3))
    likes = int(views * random.uniform(0.03, 0.09))
    comments = int(views * random.uniform(0.003, 0.012))
    shares = int(views * random.uniform(0.002, 0.01))
    return StatsResult(views=views, likes=likes, comments=comments, shares=shares)
