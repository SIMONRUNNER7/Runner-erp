from app.integrations.facebook import FacebookAdapter
from app.integrations.instagram import InstagramAdapter
from app.integrations.linkedin import LinkedInAdapter
from app.integrations.tiktok import TikTokAdapter
from app.integrations.youtube import YouTubeAdapter
from app.models import Platform

ADAPTERS = {
    Platform.youtube: YouTubeAdapter(),
    Platform.tiktok: TikTokAdapter(),
    Platform.instagram: InstagramAdapter(),
    Platform.facebook: FacebookAdapter(),
    Platform.linkedin: LinkedInAdapter(),
}

PLATFORM_LABELS = {
    Platform.youtube: "YouTube",
    Platform.tiktok: "TikTok",
    Platform.instagram: "Instagram",
    Platform.facebook: "Facebook",
    Platform.linkedin: "LinkedIn",
}

# Couleur de marque officielle de chaque réseau, utilisée pour les badges/icônes
# dans les notifications, la messagerie et les publicités.
PLATFORM_COLORS = {
    Platform.youtube: "#FF0000",
    Platform.tiktok: "#000000",
    Platform.instagram: "#E1306C",
    Platform.facebook: "#1877F2",
    Platform.linkedin: "#0A66C2",
}

PLATFORM_ICONS = {
    Platform.youtube: "▶",
    Platform.tiktok: "♪",
    Platform.instagram: "◎",
    Platform.facebook: "f",
    Platform.linkedin: "in",
}


def get_adapter(platform: Platform):
    return ADAPTERS[platform]
