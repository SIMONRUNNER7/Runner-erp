import httpx

from app.integrations import meta_common
from app.integrations.base import PlatformAdapter, PublishResult, StatsResult
from app.config import get_settings

settings = get_settings()


class FacebookAdapter(PlatformAdapter):
    name = "facebook"

    @property
    def is_configured(self) -> bool:
        return bool(settings.meta_app_id and settings.meta_app_secret)

    def get_auth_url(self, state: str) -> str:
        return meta_common.build_auth_url(state)

    def exchange_code(self, code: str) -> dict:
        user_token = meta_common.exchange_code_for_user_token(code)
        pages = meta_common.get_pages(user_token)
        if not pages:
            raise ValueError("Aucune page Facebook trouvée pour ce compte.")
        page = pages[0]
        return {
            "access_token": page["access_token"],
            "refresh_token": None,
            "account_name": page.get("name", "Page Facebook"),
            "external_id": page.get("id"),
        }

    def publish(self, account, post) -> PublishResult:
        try:
            base = f"{meta_common.GRAPH_URL}/{account.external_id}"
            if post.media_path and post.media_type == "image":
                with open(post.media_path, "rb") as f:
                    resp = httpx.post(
                        f"{base}/photos",
                        params={"access_token": account.access_token, "caption": post.effective_caption or ""},
                        files={"source": f},
                        timeout=60,
                    )
            elif post.media_path and post.media_type == "video":
                with open(post.media_path, "rb") as f:
                    resp = httpx.post(
                        f"{base}/videos",
                        params={"access_token": account.access_token, "description": post.effective_caption or ""},
                        files={"source": f},
                        timeout=120,
                    )
            else:
                resp = httpx.post(
                    f"{base}/feed",
                    params={"access_token": account.access_token, "message": post.effective_caption or ""},
                    timeout=30,
                )
            resp.raise_for_status()
            post_id = resp.json().get("post_id") or resp.json().get("id")
            return PublishResult(True, external_post_id=post_id)
        except Exception as exc:  # noqa: BLE001
            return PublishResult(False, error_message=str(exc))

    def fetch_stats(self, account, target) -> StatsResult:
        try:
            resp = httpx.get(
                f"{meta_common.GRAPH_URL}/{target.external_post_id}/insights",
                params={
                    "metric": "post_impressions,post_reactions_by_type_total,post_comments,post_shares",
                    "access_token": account.access_token,
                },
                timeout=30,
            )
            resp.raise_for_status()
            data = {d["name"]: d["values"][0]["value"] for d in resp.json().get("data", [])}
            reactions = data.get("post_reactions_by_type_total", {})
            likes = sum(reactions.values()) if isinstance(reactions, dict) else 0
            return StatsResult(
                views=data.get("post_impressions", 0),
                likes=likes,
                comments=data.get("post_comments", 0),
                shares=data.get("post_shares", 0),
            )
        except Exception:  # noqa: BLE001
            return StatsResult()
