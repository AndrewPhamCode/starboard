from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    cors_origins: list[str] = ["http://localhost:5173", "https://*.vercel.app"]
    openai_api_key: str = ""
    anthropic_api_key: str = ""

    model_config = {"env_file": ".env"}


settings = Settings()
