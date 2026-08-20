"""Moteur de scoring : évalue une publication avant envoi et donne des conseils
concrets pour maximiser sa visibilité, par plateforme."""

import re
from datetime import datetime

from app.integrations.registry import PLATFORM_LABELS
from app.models import STORY_CAPABLE_PLATFORMS, Platform, PostType

CAPTION_RANGES = {
    # (min conseillé, max conseillé) en caractères
    Platform.instagram: (70, 150),
    Platform.tiktok: (20, 100),
    Platform.facebook: (40, 120),
    Platform.linkedin: (150, 600),
    Platform.youtube: (50, 200),
}

HASHTAG_RANGES = {
    Platform.instagram: (3, 15),
    Platform.tiktok: (3, 8),
    Platform.facebook: (1, 5),
    Platform.linkedin: (2, 5),
    Platform.youtube: (2, 8),
}

MEDIA_REQUIRED = {Platform.instagram, Platform.tiktok, Platform.youtube}


def _extract_hashtags(caption: str) -> list:
    return re.findall(r"#\w+", caption or "")


def score_post(
    caption: str,
    media_type: str,
    platform: Platform,
    post_type: PostType,
    scheduled_at,
    best_slots: list,
    options: dict,
) -> dict:
    """Retourne {score: 0-100, tips: [{level, text}]}"""
    tips = []
    points = 0
    max_points = 0

    caption = caption or ""
    length = len(caption)
    hashtags = _extract_hashtags(caption) + list(options.get("hashtags", []) or [])

    # --- Média présent si requis ---
    max_points += 25
    if platform in MEDIA_REQUIRED and not media_type:
        tips.append({"level": "warn", "text": f"{PLATFORM_LABELS[platform]} nécessite un média (image ou vidéo) pour une portée optimale."})
    else:
        points += 25
        if media_type:
            tips.append({"level": "ok", "text": "Média joint : bon point pour l'engagement."})

    # --- Longueur de légende ---
    max_points += 20
    lo, hi = CAPTION_RANGES.get(platform, (30, 200))
    if length == 0:
        tips.append({"level": "warn", "text": "Ajoutez une légende : les posts avec texte génèrent plus d'interactions."})
    elif lo <= length <= hi:
        points += 20
        tips.append({"level": "ok", "text": f"Longueur de légende idéale pour {PLATFORM_LABELS[platform]} ({length} caractères)."})
    elif length < lo:
        points += 10
        tips.append({"level": "warn", "text": f"Légende un peu courte pour {PLATFORM_LABELS[platform]} (idéal : {lo}-{hi} caractères)."})
    else:
        points += 8
        tips.append({"level": "warn", "text": f"Légende plus longue que la moyenne pour {PLATFORM_LABELS[platform]} (idéal : {lo}-{hi} caractères)."})

    # --- Hashtags ---
    max_points += 20
    hlo, hhi = HASHTAG_RANGES.get(platform, (0, 10))
    if platform == Platform.linkedin and len(hashtags) > hhi:
        points += 10
        tips.append({"level": "warn", "text": "Trop de hashtags peuvent nuire au sérieux perçu sur LinkedIn : gardez-en 2 à 5."})
    elif hlo <= len(hashtags) <= hhi:
        points += 20
        tips.append({"level": "ok", "text": f"{len(hashtags)} hashtag(s) : bon dosage pour {PLATFORM_LABELS[platform]}."})
    elif len(hashtags) < hlo:
        points += 8
        tips.append({"level": "warn", "text": f"Ajoutez des hashtags pertinents ({hlo}-{hhi} conseillés) pour améliorer la découvrabilité."})
    else:
        points += 10
        tips.append({"level": "warn", "text": f"Beaucoup de hashtags : limitez-vous à {hhi} pour rester efficace."})

    # --- Horaire vs meilleur créneau ---
    max_points += 20
    if scheduled_at and best_slots:
        target_slots = {(wd, hour) for wd, hour in best_slots}
        close_match = any(
            wd == scheduled_at.weekday() and abs(hour - scheduled_at.hour) <= 1 for wd, hour in target_slots
        )
        if close_match:
            points += 20
            tips.append({"level": "ok", "text": "Horaire aligné avec un de vos meilleurs créneaux : excellent timing."})
        else:
            points += 8
            tips.append({"level": "warn", "text": "Cet horaire n'est pas dans vos meilleurs créneaux — consultez la page Conseils pour ajuster."})
    else:
        points += 12
        tips.append({"level": "warn", "text": "Publication immédiate : planifiez sur un créneau optimal pour plus de portée."})

    # --- Story bonus / cohérence ---
    max_points += 15
    if post_type == PostType.story:
        points += 15
        tips.append({"level": "ok", "text": "Les stories boostent la visibilité quotidienne et complètent bien un post fil d'actualité."})
    else:
        if options.get("first_comment") and platform == Platform.instagram:
            points += 15
            tips.append({"level": "ok", "text": "Premier commentaire utilisé : bonne pratique pour aérer la légende sur Instagram."})
        else:
            points += 10

    score = round((points / max_points) * 100) if max_points else 0
    return {"score": max(0, min(100, score)), "tips": tips}


def boost_suggestions(post, all_accounts, platform_labels) -> list:
    """Suggestions concrètes pour mettre en avant une publication déjà envoyée."""
    suggestions = []
    used_platforms = {t.platform for t in post.targets}

    if post.post_type == PostType.feed:
        story_capable_used = {p for p in used_platforms if p in STORY_CAPABLE_PLATFORMS}
        if story_capable_used:
            names = ", ".join(sorted(platform_labels[p] for p in story_capable_used))
            suggestions.append(
                {
                    "icon": "⚡",
                    "text": f"Republiez ce visuel en story sur {names} pour prolonger sa visibilité 24h de plus.",
                    "action_label": "Créer la story",
                    "action_url": f"/composer?duplicate={post.id}&post_type=story",
                }
            )

    unused_connected = {a.platform for a in all_accounts} - used_platforms
    if unused_connected:
        names = ", ".join(sorted(platform_labels[p] for p in unused_connected))
        suggestions.append(
            {
                "icon": "🔁",
                "text": f"Ce contenu n'est pas encore sur {names}. Dupliquez-le pour toucher une audience supplémentaire.",
                "action_label": "Dupliquer",
                "action_url": f"/composer?duplicate={post.id}",
            }
        )

    suggestions.append(
        {
            "icon": "🎯",
            "text": "Boostez cette publication avec un petit budget publicitaire pour multiplier sa portée.",
            "action_label": "Créer une publicité",
            "action_url": f"/ads/new?post_id={post.id}",
        }
    )
    return suggestions[:3]
