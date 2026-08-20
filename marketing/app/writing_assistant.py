"""Aide à la rédaction : modèles de légende prêts à personnaliser + reprise de vos
publications les plus performantes comme inspiration.

Pas d'appel à un modèle d'IA générative ici : ça nécessiterait une clé API (OpenAI/
Anthropic) et un budget dédié que vous n'avez pas encore configurés. Cette aide reste
utile sans dépendance externe ; si vous voulez plus tard une vraie génération de texte
par IA, il suffira de brancher une clé API dans .env sur ce module.
"""

from app.recommendations import top_performing_posts

CAPTION_TEMPLATES = {
    "Offre spéciale": [
        "🎉 Offre spéciale chez Runner Golf : [détail de l'offre] jusqu'au [date]. Réservez vite !",
        "⛳ [X]% de réduction sur [produit/service] cette semaine seulement. On vous attend !",
    ],
    "Nouveau contenu": [
        "✨ Nouveau parcours disponible : [nom/description]. Venez le découvrir dès aujourd'hui !",
        "📸 [X] photos/vidéos de notre dernier événement — swipez pour tout voir !",
    ],
    "Témoignage client": [
        "💬 « [citation du client] » — merci [prénom] pour ce retour, ça nous fait chaud au cœur !",
        "⭐ Encore un client conquis par [aspect du service]. Et vous, prêt à tenter l'expérience ?",
    ],
    "Événement": [
        "📅 Rendez-vous le [date] pour [nom de l'événement] ! Places limitées, inscrivez-vous vite.",
        "🏌️ Ce week-end : [événement]. Ambiance garantie sur le green !",
    ],
    "Conseil golf": [
        "💡 Astuce du jour : [conseil technique] pour améliorer votre swing.",
        "🎯 3 erreurs à éviter sur le practice : [liste rapide].",
    ],
    "Coulisses": [
        "👀 Dans les coulisses de Runner Golf : [ce que vous montrez aujourd'hui].",
        "🙌 Toute l'équipe se prépare pour [événement/saison] — on a hâte de vous accueillir !",
    ],
}


def get_inspiration(db, limit: int = 4) -> list:
    """Vos publications les plus performantes, à réutiliser comme base."""
    samples = top_performing_posts(db, limit=limit)
    return [
        {
            "post_id": target.post_id,
            "caption": target.post.caption,
            "platform": target.platform,
            "engagement_rate": snap.engagement_rate,
        }
        for target, snap in samples
        if target.post.caption
    ]
