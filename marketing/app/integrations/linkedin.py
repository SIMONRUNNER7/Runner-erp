from urllib.parse import urlencode

import httpx

from app.config import get_settings
from app.integrations.base import PlatformAdapter, PublishResult, StatsResult

settings = get_settings()

AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization"
TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"
API_URL = "https://api.linkedin.com/v2"

SCOPES = ["w_member_social", "r_liteprofile", "r_organization_social", "w_organization_social"]


class LinkedInAdapter(PlatformAdapter):
    name = "linkedin"

    @property
    def is_configured(self) -> bool:
        return bool(settings.linkedin_client_id and settings.linkedin_client_secret)

    def get_auth_url(self, state: str) -> str:
        params = {
            "response_type": "code",
            "client_id": settings.linkedin_client_id,
            "redirect_uri": settings.linkedin_redirect_uri,
            "scope": " ".join(SCOPES),
            "state": state,
        }
        return f"{AUTH_URL}?{urlencode(params)}"

    def exchange_code(self, code: str) -> dict:
        resp = httpx.post(
            TOKEN_URL,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings.linkedin_redirect_uri,
                "client_id": settings.linkedin_client_id,
                "client_secret": settings.linkedin_client_secret,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=30,
        )
        resp.raise_for_status()
        tokens = resp.json()

        me = httpx.get(
            f"{API_URL}/me",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
            timeout=30,
        ).json()
        name = f"{me.get('localizedFirstName', '')} {me.get('localizedLastName', '')}".strip()
        return {
            "access_token": tokens["access_token"],
            "refresh_token": tokens.get("refresh_token"),
            "account_name": name or "Profil LinkedIn",
            "external_id": me.get("id"),
        }

    def publish(self, account, post) -> PublishResult:
        try:
            author_urn = f"urn:li:person:{account.external_id}"
            body = {
                "author": author_urn,
                "lifecycleState": "PUBLISHED",
                "specificContent": {
                    "com.linkedin.ugc.ShareContent": {
                        "shareCommentary": {"text": post.effective_caption or ""},
                        "shareMediaCategory": "NONE",
                    }
                },
                "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
            }
            resp = httpx.post(
                f"{API_URL}/ugcPosts",
                headers={
                    "Authorization": f"Bearer {account.access_token}",
                    "Content-Type": "application/json",
                    "X-Restli-Protocol-Version": "2.0.0",
                },
                json=body,
                timeout=30,
            )
            resp.raise_for_status()
            post_id = resp.headers.get("x-restli-id") or resp.json().get("id")
            return PublishResult(True, external_post_id=post_id)
        except Exception as exc:  # noqa: BLE001
            return PublishResult(False, error_message=str(exc))

    def fetch_stats(self, account, target) -> StatsResult:
        try:
            resp = httpx.get(
                f"{API_URL}/socialActions/{target.external_post_id}",
                headers={"Authorization": f"Bearer {account.access_token}"},
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            return StatsResult(
                views=0,
                likes=data.get("likesSummary", {}).get("totalLikes", 0),
                comments=data.get("commentsSummary", {}).get("totalFirstLevelComments", 0),
                shares=0,
            )
        except Exception:  # noqa: BLE001
            return StatsResult()
