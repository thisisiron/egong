from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    supabase_url: str
    supabase_secret_key: str
    supabase_publishable_key: str
    allowed_origins: str = "http://localhost:3000"
    environment: str = "development"
    nts_api_key: str  # 추가 — 국세청 API 일반 인증키 (decoded)

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
