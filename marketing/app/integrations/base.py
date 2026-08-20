from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional


@dataclass
class PublishResult:
    success: bool
    external_post_id: Optional[str] = None
    error_message: Optional[str] = None


@dataclass
class StatsResult:
    views: int = 0
    likes: int = 0
    comments: int = 0
    shares: int = 0

    @property
    def engagement_rate(self) -> float:
        if self.views <= 0:
            return 0.0
        return round((self.likes + self.comments + self.shares) / self.views * 100, 2)


class PlatformAdapter(ABC):
    """Interface commune à toutes les plateformes.

    Tant que `is_configured` est False (pas de clés API dans .env), le
    PublishService bascule automatiquement en mode simulation pour cette
    plateforme : le reste de l'app (composer, planification, stats,
    recommandations) fonctionne normalement avec des données fictives.
    """

    name: str

    @property
    @abstractmethod
    def is_configured(self) -> bool:
        ...

    @abstractmethod
    def get_auth_url(self, state: str) -> str:
        ...

    @abstractmethod
    def exchange_code(self, code: str) -> dict:
        """Retourne un dict avec au moins access_token, refresh_token (optionnel), account_name, external_id."""

    @abstractmethod
    def publish(self, account, post) -> PublishResult:
        ...

    @abstractmethod
    def fetch_stats(self, account, target) -> StatsResult:
        ...
