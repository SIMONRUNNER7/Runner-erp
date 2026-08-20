import json
from urllib.parse import urlencode

import httpx

from app.config import get_settings
from app.integrations.base import PlatformAdapter, PublishResult, StatsResult

settings = get_settings()

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos"
API_URL = "https://www.googleapis.com/youtube/v3"

SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
]


class YouTubeAdapter(PlatformAdapter):
    name = "youtube"

    @property
    def is_configured(self) -> bool:
        return bool(settings.youtube_client_id and settings.youtube_client_secret)

    def get_auth_url(self, state: str) -> str:
        params = {
            "client_id": settings.youtube_client_id,
            "redirect_uri": settings.youtube_redirect_uri,
            "response_type": "code",
            "scope": " ".join(SCOPES),
            "access_type": "offline",
            "prompt": "consent",
            "state": state,
        }
        return f"{AUTH_URL}?{urlencode(params)}"

    def exchange_code(self, code: str) -> dict:
        resp = httpx.post(
            TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.youtube_client_id,
                "client_secret": settings.youtube_client_secret,
                "redirect_uri": settings.youtube_redirect_uri,
                "grant_type": "authorization_code",
            },
            timeout=30,
        )
        resp.raise_for_status()
        tokens = resp.json()

        me = httpx.get(
            f"{API_URL}/channels",
            params={"part": "snippet", "mine": "true"},
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
            timeout=30,
        ).json()
        channel = (me.get("items") or [{}])[0]
        return {
            "access_token": tokens["access_token"],
            "refresh_token": tokens.get("refresh_token"),
            "account_name": channel.get("snippet", {}).get("title", "Chaîne YouTube"),
            "external_id": channel.get("id"),
        }

    def publish(self, account, post) -> PublishResult:
        if not post.media_path or post.media_type != "video":
            return PublishResult(False, error_message="YouTube nécessite une vidéo.")
        try:
            metadata = {
                "snippet": {
                    "title": (post.caption or "Runner Golf")[:100],
                    "description": post.effective_caption or "",
                },
                "status": {"privacyStatus": "public"},
            }
            with open(post.media_path, "rb") as f:
                video_bytes = f.read()
            files = {
                "metadata": (None, json.dumps(metadata), "application/json; charset=UTF-8"),
                "media": (post.media_path, video_bytes, "video/mp4"),
            }
            resp = httpx.post(
                UPLOAD_URL,
                params={"uploadType": "multipart", "part": "snippet,status"},
                headers={"Authorization": f"Bearer {account.access_token}"},
                files=files,
                timeout=120,
            )
            resp.raise_for_status()
            video_id = resp.json().get("id")
            return PublishResult(True, external_post_id=video_id)
        except Exception as exc:  # noqa: BLE001
            return PublishResult(False, error_message=str(exc))

    def fetch_stats(self, account, target) -> StatsResult:
        try:
            resp = httpx.get(
                f"{API_URL}/videos",
                params={"part": "statistics", "id": target.external_post_id},
                headers={"Authorization": f"Bearer {account.access_token}"},
                timeout=30,
            )
            resp.raise_for_status()
            items = resp.json().get("items") or []
            if not items:
                return StatsResult()
            stats = items[0]["statistics"]
            return StatsResult(
                views=int(stats.get("viewCount", 0)),
                likes=int(stats.get("likeCount", 0)),
                comments=int(stats.get("commentCount", 0)),
                shares=0,
            )
        except Exception:  # noqa: BLE001
            return StatsResult()
