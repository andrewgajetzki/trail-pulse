import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.main import app
from app.models import ObservationProfile, ObservationType, User


class AuthRouteTests(unittest.TestCase):
    def tearDown(self) -> None:
        app.dependency_overrides.clear()

    def test_auth_me_rejects_missing_bearer_token(self) -> None:
        with TestClient(app) as client:
            response = client.get("/auth/me")

        self.assertEqual(response.status_code, 401)

    def test_trips_reject_missing_bearer_token(self) -> None:
        with TestClient(app) as client:
            response = client.get("/trips")

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

    def test_create_trip_uses_the_authenticated_user(self) -> None:
        app.dependency_overrides[get_current_user] = lambda: User(id=2, name="Trail Rider")
        created_trips = []

        class Session:
            def __enter__(self):
                return self

            def __exit__(self, *_):
                return None

            def add(self, model) -> None:
                if isinstance(model, User):
                    return
                created_trips.append(model)

            def add_all(self, _) -> None:
                return None

            def scalar(self, _) -> ObservationProfile:
                return ObservationProfile(
                    id=5,
                    user_id=2,
                    name="Trail Friendliness",
                    is_active=True,
                )

            def scalars(self, _):
                return [
                    ObservationType(id=6, profile_id=5, label="Greeted us", icon="🙂", sort_order=1),
                    ObservationType(id=7, profile_id=5, label="No response", icon="😐", sort_order=2),
                ]

            def flush(self) -> None:
                created_trips[0].id = 9

        with patch("app.main.SessionLocal", return_value=Session()):
            with TestClient(app) as client:
                response = client.post(
                    "/trips",
                    json={
                        "started_at": 1_000,
                        "ended_at": 2_000,
                        "location_points": [
                            {
                                "recorded_at": 1_000,
                                "latitude": 51.0,
                                "longitude": -114.0,
                            },
                        ],
                        "interactions": [],
                    },
                )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(created_trips[0].user_id, 2)
        self.assertEqual(created_trips[0].observation_profile_id, 5)
