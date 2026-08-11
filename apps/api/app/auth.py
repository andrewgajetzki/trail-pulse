import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .database import SessionLocal
from .models import User


class TokenValidationError(Exception):
    """Raised when an access token cannot be trusted."""


@dataclass(frozen=True)
class JwtSettings:
    secret: str
    algorithm: str
    expire_minutes: int


def get_jwt_settings() -> JwtSettings:
    secret = os.getenv("JWT_SECRET")
    algorithm = os.getenv("JWT_ALGORITHM", "HS256")

    if not secret:
        raise RuntimeError("JWT_SECRET must be configured")

    try:
        expire_minutes = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))
    except ValueError as error:
        raise RuntimeError("JWT_EXPIRE_MINUTES must be an integer") from error

    if expire_minutes <= 0:
        raise RuntimeError("JWT_EXPIRE_MINUTES must be greater than zero")

    return JwtSettings(
        secret=secret,
        algorithm=algorithm,
        expire_minutes=expire_minutes,
    )


def create_access_token(user_id: int) -> str:
    """Create a signed access token whose subject is a Trail Pulse user ID."""
    if user_id <= 0:
        raise ValueError("user_id must be positive")

    settings = get_jwt_settings()
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.expire_minutes,
    )

    return jwt.encode(
        {"sub": str(user_id), "exp": expires_at},
        settings.secret,
        algorithm=settings.algorithm,
    )


def decode_access_token(token: str) -> int:
    """Validate a token and return its Trail Pulse user ID."""
    settings = get_jwt_settings()

    try:
        payload = jwt.decode(
            token,
            settings.secret,
            algorithms=[settings.algorithm],
            options={"require": ["sub", "exp"]},
        )
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, TypeError, ValueError) as error:
        raise TokenValidationError("Invalid access token") from error

    if user_id <= 0:
        raise TokenValidationError("Invalid access token")

    return user_id


bearer_scheme = HTTPBearer(auto_error=False)


def unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired access token",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> User:
    """Load the authenticated user identified by a valid Bearer token."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise unauthorized()

    try:
        user_id = decode_access_token(credentials.credentials)
    except (RuntimeError, TokenValidationError):
        raise unauthorized() from None

    with SessionLocal() as session:
        user = session.get(User, user_id)

        if user is None:
            raise unauthorized()

        session.expunge(user)
        return user
