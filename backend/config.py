from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    DATABASE_URL: str
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    ADMIN_REFRESH_TOKEN_EXPIRE_HOURS: int = 8
    CLIENT_REFRESH_TOKEN_EXPIRE_HOURS: int = 24
    RESEND_API_KEY: str
    RESEND_FROM_EMAIL: str
    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str
    ALLOWED_ORIGINS: str = ""
    ENVIRONMENT: str = "development"
    WEBAUTHN_RP_ID: str
    WEBAUTHN_RP_NAME: str
    CRON_SECRET: str = ""

    @property
    def webauthn_origin(self) -> str:
        if self.WEBAUTHN_RP_ID == "localhost":
            return "http://localhost:5173"
        return f"https://{self.WEBAUTHN_RP_ID}"

    @property
    def allowed_origins_list(self) -> list[str]:
        origins = [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]
        if self.ENVIRONMENT == "development":
            if "http://localhost:5173" not in origins:
                origins.append("http://localhost:5173")
        return origins

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
