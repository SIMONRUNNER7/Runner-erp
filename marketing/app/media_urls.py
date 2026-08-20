"""Conversion d'un média stocké localement en URL publique.

Les médias sont enregistrés sur disque dans `data/uploads/` et servis par
l'application sur `/uploads/...`. La plupart des plateformes (Facebook, YouTube,
TikTok) reçoivent directement le contenu du fichier, mais l'API Graph
d'Instagram exige une **URL publique** qu'elle ira télécharger elle-même : un
chemin local ne peut pas fonctionner.
"""

import os
from typing import Optional

from app.config import get_settings

UPLOAD_DIR = "data/uploads"


class PublicUrlUnavailable(Exception):
    """PUBLIC_BASE_URL n'est pas configuré : impossible de fabriquer une URL publique."""


def public_media_url(media_path: Optional[str]) -> str:
    """URL publique du média, telle qu'une plateforme externe peut la télécharger.

    Lève PublicUrlUnavailable si l'application ne connaît pas sa propre adresse
    publique (typiquement en développement local), plutôt que de transmettre un
    chemin local qui ferait échouer la publication avec une erreur incompréhensible.
    """
    if not media_path:
        raise PublicUrlUnavailable("Aucun média associé à cette publication.")

    # Déjà une URL (média référencé depuis un stockage externe) : rien à faire.
    if media_path.startswith(("http://", "https://")):
        return media_path

    settings = get_settings()
    if not settings.public_base_url:
        raise PublicUrlUnavailable(
            "PUBLIC_BASE_URL n'est pas renseigné dans le fichier .env. Instagram doit "
            "pouvoir télécharger le média depuis Internet : indiquez l'adresse publique "
            "de l'application (ex. https://communication.runner.golf)."
        )

    return f"{settings.public_base_url.rstrip('/')}/uploads/{os.path.basename(media_path)}"
