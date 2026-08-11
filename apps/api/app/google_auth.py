import os
from typing import Any

from google.auth.transport import requests
from google.oauth2 import id_token


class GoogleTokenValidationError(Exception):
    """Raised when a Google ID token is not valid for this application."""


def verify_google_id_token(raw_id_token: str) -> dict[str, Any]:
    """Verify a Google ID token and return only Google-verified claims."""
    client_id = os.getenv("GOOGLE_CLIENT_ID")

    if not client_id:
        raise RuntimeError("GOOGLE_CLIENT_ID must be configured")

    try:
        claims = id_token.verify_oauth2_token(
            raw_id_token,
            requests.Request(),
            client_id,
        )
    except ValueError as error:
        raise GoogleTokenValidationError("Invalid Google ID token") from error

    # google-auth verifies this too; keep the explicit check close to the route.
    if claims.get("iss") not in {"accounts.google.com", "https://accounts.google.com"}:
        raise GoogleTokenValidationError("Invalid Google ID token issuer")

    return claims
