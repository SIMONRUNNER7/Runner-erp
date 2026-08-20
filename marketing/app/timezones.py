"""Gestion centralisée des fuseaux horaires.

Convention interne : toutes les dates stockées en base (scheduled_at, published_at,
created_at...) sont des datetime naïves en UTC (datetime.utcnow()). Cette convention
ne change pas.

Ce qui change : l'app a un fuseau "de référence" pour l'équipe qui l'utilise —
Europe/Paris, puisque Runner Golf est basé en France — utilisé pour :
- interpréter les horaires saisis dans le composer ("Planifier pour 18h" = 18h Paris),
- afficher les dates aux utilisateurs,
- exprimer les créneaux de recommandation.

Une bonne partie de l'audience étant anglo-américaine, les créneaux conseillés sont
systématiquement doublés avec leur équivalent America/New_York.
"""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

APP_TZ = ZoneInfo("Europe/Paris")
SECONDARY_TZ = ZoneInfo("America/New_York")
SECONDARY_TZ_LABEL = "New York"
UTC_TZ = ZoneInfo("UTC")

WEEKDAYS_FR = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]


def parse_app_local_datetime(raw: str):
    """Convertit une valeur <input type=datetime-local> (heure de Paris, naïve)
    en datetime naïve UTC prête à être stockée en base."""
    if not raw:
        return None
    try:
        naive = datetime.fromisoformat(raw)
    except ValueError:
        return None
    return naive.replace(tzinfo=APP_TZ).astimezone(UTC_TZ).replace(tzinfo=None)


def utc_to_app_local(dt_utc: datetime) -> datetime:
    """Datetime naïve UTC (stockée en base) -> datetime naïve heure de Paris (affichage)."""
    return dt_utc.replace(tzinfo=UTC_TZ).astimezone(APP_TZ).replace(tzinfo=None)


def format_local(dt_utc, fmt: str = "%d/%m/%Y %H:%M") -> str:
    """Filtre Jinja : affiche une date stockée (UTC) en heure de Paris."""
    if not dt_utc:
        return ""
    return utc_to_app_local(dt_utc).strftime(fmt)


def localize_slot_label(weekday: int, hour: int) -> str:
    """weekday/hour exprimés en heure de Paris -> libellé bilingue Paris + New York."""
    base = datetime(2024, 1, 1 + weekday, hour, tzinfo=APP_TZ)  # 2024-01-01 est un lundi
    secondary = base.astimezone(SECONDARY_TZ)
    return (
        f"{WEEKDAYS_FR[weekday].capitalize()} {hour}h (Paris) · "
        f"{WEEKDAYS_FR[secondary.weekday()].capitalize()} {secondary.hour}h ({SECONDARY_TZ_LABEL})"
    )


def next_occurrence_app_local(weekday: int, hour: int) -> datetime:
    """Prochaine date/heure (naïve, heure de Paris) correspondant à ce créneau
    weekday/hour — directement utilisable comme valeur d'un <input datetime-local>."""
    now_local = datetime.now(APP_TZ)
    days_ahead = (weekday - now_local.weekday()) % 7
    candidate = (now_local + timedelta(days=days_ahead)).replace(minute=0, second=0, microsecond=0, hour=hour)
    if candidate <= now_local:
        candidate += timedelta(days=7)
    return candidate.replace(tzinfo=None)
