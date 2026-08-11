import os
import unittest
from datetime import datetime, timedelta, timezone

import jwt

from app.auth import TokenValidationError, create_access_token, decode_access_token


class AuthTokenTests(unittest.TestCase):
    def setUp(self) -> None:
        os.environ["JWT_SECRET"] = "test-secret-that-is-at-least-32-bytes"
        os.environ["JWT_ALGORITHM"] = "HS256"
        os.environ["JWT_EXPIRE_MINUTES"] = "60"

    def test_creates_and_decodes_token_for_user(self) -> None:
        token = create_access_token(42)

        self.assertEqual(decode_access_token(token), 42)

    def test_rejects_expired_token(self) -> None:
        token = jwt.encode(
            {
                "sub": "42",
                "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
            },
            os.environ["JWT_SECRET"],
            algorithm=os.environ["JWT_ALGORITHM"],
        )

        with self.assertRaises(TokenValidationError):
            decode_access_token(token)
