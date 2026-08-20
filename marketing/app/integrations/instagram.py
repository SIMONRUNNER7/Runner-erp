import httpx

from app.integrations import meta_common
from app.media_urls import PublicUrlUnavailable, public_media_url
from app.integrations.base import PlatformAdapter, PublishResult, StatsResult
from app.config import get_settings

settings = get_settings()


class InstagramAdapter(PlatformAdapter):
    name = "instagram"

    @property
    def is_configured(self) -> bool:
        return bool(settings.meta_app_id and settings.meta_app_secret)

    def get_auth_url(self, state: str) -> str:
        return meta_common.build_auth_url(state)

    def exchange_code(self, code: str) -> dict:
        user_token = meta_common.exchange_code_for_user_token(code)
        pages = meta_common.get_pages(user_token)
        for page in pages:
            resp = httpx.get(
                f"{meta_common.GRAPH_URL}/{page['id']}",
                params={"fields": "instagram_business_account,name", "access_token": page["access_token"]},
                timeout=30,
            )
            data = resp.json()
            ig_account = data.get("instagram_business_account")
            if ig_account:
                ig_id = ig_account["id"]
                profile = httpx.get(
                    f"{meta_common.GRAPH_URL}/{ig_id}",
                    params={"fields": "username", "access_token": page["access_token"]},
                    timeout=30,
                ).json()
                return {
                    "access_token": page["access_token"],
                    "refresh_token": None,
                    "account_name": "@" + profile.get("username", "instagram"),
                    "external_id": ig_id,
                }
        raise ValueError(
            "Aucun compte Instagram Business/Creator lié à une page Facebook n'a été trouvé."
        )

    def publish(self, account, post) -> PublishResult:
        try:
            base = f"{meta_common.GRAPH_URL}/{account.external_id}"
            if not post.media_path:
                return PublishResult(False, error_message="Instagram nécessite une image ou une vidéo.")

            # L'API Graph télécharge le média depuis une URL publique : elle ne
            # peut pas lire le fichier sur le disque du serveur.
            try:
                media_url = public_media_url(post.media_path)
            except PublicUrlUnavailable as exc:
                return PublishResult(False, error_message=str(exc))

            media_field = "video_url" if post.media_type == "video" else "image_url"
            container_resp = httpx.post(
                f"{base}/media",
                params={
                    media_field: media_url,
                    "caption": post.effective_caption or "",
                    "access_token": account.access_token,
                },
                timeout=60,
            )
            container_resp.raise_for_status()
            creation_id = container_resp.json()["id"]

            publish_resp = httpx.post(
                f"{base}/media_publish",
                params={"creation_id": creation_id, "access_token": account.access_token},
                timeout=60,
            )
            publish_resp.raise_for_status()
            return PublishResult(True, external_post_id=publish_resp.json().get("id"))
        except Exception as exc:  # noqa: BLE001
            return PublishResult(False, error_message=str(exc))

    def fetch_stats(self, account, target) -> StatsResult:
        try:
            resp = httpx.get(
                f"{meta_common.GRAPH_URL}/{target.external_post_id}/insights",
                params={
                    "metric": "impressions,likes,comments,shares",
                    "access_token": account.access_token,
                },
                timeout=30,
            )
            resp.raise_for_status()
            data = {d["name"]: d["values"][0]["value"] for d in resp.json().get("data", [])}
            return StatsResult(
                views=data.get("impressions", 0),
                likes=data.get("likes", 0),
                comments=data.get("comments", 0),
                shares=data.get("shares", 0),
            )
        except Exception:  # noqa: BLE001
            return StatsResult()
