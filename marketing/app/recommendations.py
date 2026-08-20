from collections import defaultdict
from datetime import timedelta

from sqlalchemy.orm import Session

from app.integrations.registry import PLATFORM_LABELS
from app.models import Notification, NotificationType, Platform, PostTarget, StatSnapshot, TargetStatus
from app.timezones import (
    APP_TZ,
    localize_slot_label,
    next_occurrence_app_local,
    utc_to_app_local,
)
from datetime import datetime as _datetime

# Créneaux de référence (bonnes pratiques générales du secteur), exprimés en heure de
# Paris — utilisés tant qu'il n'y a pas assez de données propres à Runner Golf pour un
# créneau fiable. Une bonne partie de l'audience étant anglo-américaine, chaque créneau
# est aussi affiché dans son équivalent America/New_York (voir localize_slot_label).
DEFAULT_BEST_SLOTS = {
    Platform.youtube: [(5, 17), (6, 10), (3, 18)],       # sam 17h, dim 10h, jeu 18h (Paris)
    Platform.tiktok: [(1, 19), (3, 20), (5, 11)],        # mar 19h, jeu 20h, sam 11h (Paris)
    Platform.instagram: [(2, 12), (4, 18), (6, 10)],     # mer 12h, ven 18h, dim 10h (Paris)
    Platform.facebook: [(2, 13), (4, 15), (5, 12)],      # mer 13h, ven 15h, sam 12h (Paris)
    Platform.linkedin: [(1, 8), (2, 12), (3, 17)],       # mar 8h, mer 12h, jeu 17h (Paris) -> couvre aussi le matin US
}

MIN_SAMPLES_FOR_DATA_DRIVEN = 5


def _latest_snapshot_per_target(db: Session):
    """Retourne le dernier snapshot de stats pour chaque post_target publié."""
    targets = (
        db.query(PostTarget)
        .filter(PostTarget.status == TargetStatus.published, PostTarget.published_at.isnot(None))
        .all()
    )
    result = []
    for t in targets:
        snap = (
            db.query(StatSnapshot)
            .filter(StatSnapshot.target_id == t.id)
            .order_by(StatSnapshot.captured_at.desc())
            .first()
        )
        if snap:
            result.append((t, snap))
    return result


def best_times_by_platform(db: Session) -> dict:
    """Pour chaque plateforme, retourne les 3 meilleurs créneaux (jour, heure — heure
    de Paris) en se basant sur l'engagement historique, avec repli sur des bonnes
    pratiques génériques si pas assez de données. Chaque créneau est accompagné de son
    libellé bilingue Paris + New York."""
    samples = _latest_snapshot_per_target(db)
    by_platform_slot = defaultdict(list)  # (platform, weekday, hour) -> [engagement_rate,...]

    for target, snap in samples:
        published_paris = utc_to_app_local(target.published_at)
        by_platform_slot[(target.platform, published_paris.weekday(), published_paris.hour)].append(
            snap.engagement_rate
        )

    out = {}
    for platform in Platform:
        slots = [
            (wd, hour, sum(v) / len(v), len(v))
            for (p, wd, hour), v in by_platform_slot.items()
            if p == platform
        ]
        slots.sort(key=lambda s: s[2], reverse=True)
        data_driven = len(samples_for(samples, platform)) >= MIN_SAMPLES_FOR_DATA_DRIVEN

        if data_driven and slots:
            chosen = [(wd, hour) for wd, hour, _, _ in slots[:3]]
        else:
            chosen = DEFAULT_BEST_SLOTS[platform]

        out[platform] = {
            "source": "data" if (data_driven and slots) else "default",
            "slots": chosen,
            "labels": [localize_slot_label(wd, hour) for wd, hour in chosen],
        }
    return out


def samples_for(samples, platform):
    return [s for s in samples if s[0].platform == platform]


def top_performing_posts(db: Session, limit: int = 5):
    samples = _latest_snapshot_per_target(db)
    samples.sort(key=lambda s: s[1].engagement_rate, reverse=True)
    return samples[:limit]


def content_insights(db: Session) -> list:
    """Conseils simples dérivés des posts historiques (type de média le plus performant, etc.)."""
    samples = _latest_snapshot_per_target(db)
    insights = []
    if len(samples) < 3:
        insights.append(
            "Publiez régulièrement (au moins 3-4 posts) pour que les recommandations se basent sur vos "
            "propres performances plutôt que sur des moyennes du secteur."
        )
        return insights

    by_type = defaultdict(list)
    for target, snap in samples:
        media_type = target.post.media_type or "texte"
        by_type[media_type].append(snap.engagement_rate)

    avgs = {k: sum(v) / len(v) for k, v in by_type.items() if v}
    if len(avgs) > 1:
        best_type = max(avgs, key=avgs.get)
        worst_type = min(avgs, key=avgs.get)
        if best_type != worst_type:
            ratio = avgs[best_type] / avgs[worst_type] if avgs[worst_type] > 0 else 0
            insights.append(
                f"Vos publications de type « {best_type} » génèrent en moyenne "
                f"{avgs[best_type]:.1f}% d'engagement, contre {avgs[worst_type]:.1f}% pour « {worst_type} »"
                f"{' (soit ' + str(round(ratio, 1)) + 'x plus)' if ratio > 1 else ''}. Privilégiez « {best_type} »."
            )

    by_platform = defaultdict(list)
    for target, snap in samples:
        by_platform[target.platform].append(snap.engagement_rate)
    platform_avgs = {p: sum(v) / len(v) for p, v in by_platform.items() if v}
    if platform_avgs:
        best_platform = max(platform_avgs, key=platform_avgs.get)
        insights.append(
            f"{PLATFORM_LABELS[best_platform]} est votre plateforme la plus engageante actuellement "
            f"({platform_avgs[best_platform]:.1f}% d'engagement moyen)."
        )

    return insights


def generate_upcoming_notifications(db: Session) -> int:
    """Crée des notifications 'meilleur moment pour poster' pour les prochaines
    30h, en évitant les doublons. Retourne le nombre de notifications créées."""
    now_local = _datetime.now(APP_TZ)
    recommendations = best_times_by_platform(db)
    created = 0

    for platform, info in recommendations.items():
        for wd, hour in info["slots"][:1]:  # le meilleur créneau seulement, par plateforme
            candidate = next_occurrence_app_local(wd, hour).replace(tzinfo=APP_TZ)
            if candidate - now_local > timedelta(hours=30):
                continue

            recent_dup = (
                db.query(Notification)
                .filter(
                    Notification.type == NotificationType.best_time,
                    Notification.platform == platform,
                    Notification.created_at >= _datetime.utcnow() - timedelta(hours=20),
                )
                .first()
            )
            if recent_dup:
                continue

            db.add(
                Notification(
                    type=NotificationType.best_time,
                    title=f"Meilleur moment pour poster sur {PLATFORM_LABELS[platform]}",
                    message=(
                        f"{localize_slot_label(wd, hour)} est historiquement votre créneau le plus "
                        f"engageant sur {PLATFORM_LABELS[platform]}"
                        + (" (source : vos données)" if info["source"] == "data" else " (bonnes pratiques du secteur)")
                        + ". Pensez à préparer une publication."
                    ),
                    platform=platform,
                )
            )
            created += 1
    db.commit()
    return created
