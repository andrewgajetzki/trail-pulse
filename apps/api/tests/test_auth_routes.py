import unittest

from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.main import app
from app.models import User


class AuthRouteTests(unittest.TestCase):
    def tearDown(self) -> None:
        app.dependency_overrides.clear()

    def test_auth_me_rejects_missing_bearer_token(self) -> None:
        with TestClient(app) as client:
            response = client.get("/auth/me")

        self.assertEqual(response.status_code, 401)

    def test_auth_me_returns_the_authenticated_user(self) -> None:
        app.dependency_overrides[get_current_user] = lambda: User(
            id=2,
            name="Trail Rider",
            email="rider@example.com",
            picture_url="https://example.com/rider.jpg",
        )

        with TestClient(app) as client:
            response = client.get("/auth/me")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "id": 2,
                "email": "rider@example.com",
                "name": "Trail Rider",
                "picture_url": "https://example.com/rider.jpg",
            },
        )
