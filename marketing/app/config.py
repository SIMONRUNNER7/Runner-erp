from functools import lru_cache
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    secret_key: str = "change-me"
    database_url: str = "sqlite:///./data/runnergolf.db"

    # URL publique de CETTE application, sans slash final (ex: https://communication.runner.golf).
    # Indispensable pour Instagram : l'API Graph exige une URL publique pour le média,
    # elle ne sait pas lire un fichier local. Laisser vide en développement.
    public_base_url: str = ""

    # --- Intégration ERP (onglet "Communication") ---
    # Secret partagé avec l'ERP pour signer les jetons SSO (HS256). Doit être
    # identique à MARKETING_SSO_SECRET côté ERP. Vide = SSO désactivé.
    erp_sso_secret: str = ""
    # Origine exacte de l'ERP autorisée à embarquer cette app en iframe
    # (ex: https://erp.runner.golf). Vide = aucun site tiers autorisé.
    erp_origin: str = ""

    youtube_client_id: str = ""
    youtube_client_secret: str = ""
    youtube_redirect_uri: str = ""

    tiktok_client_key: str = ""
    tiktok_client_secret: str = ""
    tiktok_redirect_uri: str = ""

    meta_app_id: str = ""
    meta_app_secret: str = ""
    meta_redirect_uri: str = ""

    linkedin_client_id: str = ""
    linkedin_client_secret: str = ""
    linkedin_redirect_uri: str = ""

    @field_validator("public_base_url", "erp_origin")
    @classmethod
    def _strip_trailing_slash(cls, value: str) -> str:
        """Une URL saisie avec un slash final ferait échouer silencieusement la
        comparaison d'origine (le navigateur envoie toujours l'origine sans slash)."""
        return value.rstrip("/")

    @property
    def is_https(self) -> bool:
        """True quand l'app est servie en HTTPS (production). Les cookies ne sont
        marqués Secure que dans ce cas, sinon la connexion casserait en local."""
        return self.public_base_url.startswith("https://")


@lru_cache
def get_settings() -> Settings:
    return Settings()
