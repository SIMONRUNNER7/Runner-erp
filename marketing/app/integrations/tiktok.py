from urllib.parse import urlencode

import httpx

from app.config import get_settings
from app.integrations.base import PlatformAdapter, PublishResult, StatsResult

settings = get_settings()

AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/"
TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/"
API_URL = "https://open.tiktokapis.com/v2"

SCOPES = ["user.info.basic", "video.publish", "video.list"]


class TikTokAdapter(PlatformAdapter):
    name = "tiktok"

    @property
    def is_configured(self) -> bool:
        return bool(settings.tiktok_client_key and settings.tiktok_client_secret)

    def get_auth_url(self, state: str) -> str:
        params = {
            "client_key": settings.tiktok_client_key,
            "redirect_uri": settings.tiktok_redirect_uri,
            "response_type": "code",
            "scope": ",".join(SCOPES),
            "state": state,
        }
        return f"{AUTH_URL}?{urlencode(params)}"

    def exchange_code(self, code: str) -> dict:
        resp = httpx.post(
            TOKEN_URL,
            data={
                "client_key": settings.tiktok_client_key,
                "client_secret": settings.tiktok_client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": settings.tiktok_redirect_uri,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=30,
        )
        resp.raise_for_status()
        tokens = resp.json()

        me = httpx.get(
            f"{API_URL}/user/info/",
            params={"fields": "open_id,display_name"},
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
            timeout=30,
        ).json()
        user = me.get("data", {}).get("user", {})
        return {
            "access_token": tokens["access_token"],
            "refresh_token": tokens.get("refresh_token"),
            "account_name": user.get("display_name", "Compte TikTok"),
            "external_id": user.get("open_id"),
        }

    def publish(self, account, post) -> PublishResult:
        if not post.media_path or post.media_type != "video":
            return PublishResult(False, error_message="TikTok nécessite une vidéo.")
        try:
            init_resp = httpx.post(
                f"{API_URL}/post/publish/video/init/",
                headers={
                    "Authorization": f"Bearer {account.access_token}",
                    "Content-Type": "application/json",
                },
                json={
                    "post_info": {
                        "title": post.effective_caption or "",
                        "privacy_level": "PUBLIC_TO_EVERYONE",
                    },
                    "source_info": {"source": "FILE_UPLOAD"},
                },
                timeout=30,
            )
            init_resp.raise_for_status()
            data = init_resp.json().get("data", {})
            publish_id = data.get("publish_id")
            upload_url = data.get("upload_url")
            if upload_url:
                with open(post.media_path, "rb") as f:
                    httpx.put(upload_url, content=f.read(), timeout=120)
            return PublishResult(True, external_post_id=publish_id)
        except Exception as exc:  # noqa: BLE001
            return PublishResult(False, error_message=str(exc))

    def fetch_stats(self, account, target) -> StatsResult:
        try:
            resp = httpx.post(
                f"{API_URL}/video/query/",
                headers={
                    "Authorization": f"Bearer {account.access_token}",
                    "Content-Type": "application/json",
                },
                params={"fields": "id,like_count,comment_count,share_count,view_count"},
                json={"filters": {"video_ids": [target.external_post_id]}},
                timeout=30,
            )
            resp.raise_for_status()
            videos = resp.json().get("data", {}).get("videos") or []
            if not videos:
                return StatsResult()
            v = videos[0]
            return StatsResult(
                views=v.get("view_count", 0),
                likes=v.get("like_count", 0),
                comments=v.get("comment_count", 0),
                shares=v.get("share_count", 0),
            )
        except Exception:  # noqa: BLE001
            return StatsResult()
