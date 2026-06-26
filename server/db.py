from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from supabase import Client

_client: "Client | None" = None


def _base_url(url: str) -> str:
    if "/rest/v1" in url:
        return url.split("/rest/v1")[0]
    return url.rstrip("/")


def get_supabase() -> "Client":
    global _client
    if _client is None:
        from supabase import create_client
        from app.config import settings
        _client = create_client(
            _base_url(settings.supabase_url),
            settings.supabase_service_role_key,
        )
    return _client
