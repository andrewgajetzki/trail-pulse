"""Opt-in integration coverage against the configured PostgreSQL database."""

import os
import unittest
import uuid

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.auth import create_access_token
from app.database import SessionLocal
from app.main import app
from app.models import LocationPoint, Observation, ObservationProfile, ObservationType, Trip, User


@unittest.skipUnless(os.getenv("RUN_DATABASE_INTEGRATION") == "1", "database integration test")
class TripUploadIntegrationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.trip_ids: list[int] = []
        suffix = uuid.uuid4().hex
        with SessionLocal.begin() as session:
            self.user = User(google_subject=f"integration-{suffix}", name="Integration Rider")
            session.add(self.user)
            session.flush()
            self.profile_ids = []
            self.type_ids = []
            for name, label, icon in (
                ("Trail Friendliness", "Greeted us", "🙂"),
                ("Wildlife", "Bear", "🐻"),
            ):
                profile = ObservationProfile(user_id=self.user.id, name=name, is_active=True)
                session.add(profile)
                session.flush()
                observation_type = ObservationType(
                    profile_id=profile.id,
                    label=label,
                    icon=icon,
                    sort_order=1,
                    is_active=True,
                )
                session.add(observation_type)
                session.flush()
                self.profile_ids.append(profile.id)
                self.type_ids.append(observation_type.id)
            self.user_id = self.user.id
        self.headers = {"Authorization": f"Bearer {create_access_token(self.user_id)}"}

    def tearDown(self) -> None:
        with SessionLocal.begin() as session:
            session.execute(delete(Observation).where(Observation.trip_id.in_(self.trip_ids)))
            session.execute(delete(LocationPoint).where(LocationPoint.trip_id.in_(self.trip_ids)))
            session.execute(delete(Trip).where(Trip.id.in_(self.trip_ids)))
            session.execute(delete(ObservationType).where(ObservationType.profile_id.in_(self.profile_ids)))
            session.execute(delete(ObservationProfile).where(ObservationProfile.id.in_(self.profile_ids)))
            session.execute(delete(User).where(User.id == self.user_id))

    def test_persists_trips_for_trail_friendliness_and_wildlife(self) -> None:
        with TestClient(app) as client:
            for index, (profile_id, observation_type_id) in enumerate(zip(self.profile_ids, self.type_ids)):
                response = client.post(
                    "/trips",
                    headers=self.headers,
                    json={
                        "started_at": 1_000 + index * 10_000,
                        "ended_at": 2_000 + index * 10_000,
                        "observation_profile_id": profile_id,
                        "location_points": [
                            {"recorded_at": 1_000, "latitude": 51.0, "longitude": -114.0},
                            {"recorded_at": 2_000, "latitude": 51.01, "longitude": -114.01},
                        ],
                        "observations": [
                            {
                                "recorded_at": 1_500,
                                "latitude": 51.005,
                                "longitude": -114.005,
                                "observation_type_id": observation_type_id,
                            },
                        ],
                    },
                )
                self.assertEqual(response.status_code, 201, response.text)
                self.trip_ids.append(response.json()["id"])

        with SessionLocal() as session:
            trips = session.scalars(select(Trip).where(Trip.id.in_(self.trip_ids))).all()
            observations = session.scalars(select(Observation).where(Observation.trip_id.in_(self.trip_ids))).all()
            points = session.scalars(select(LocationPoint).where(LocationPoint.trip_id.in_(self.trip_ids))).all()

        self.assertEqual({trip.observation_profile_id for trip in trips}, set(self.profile_ids))
        self.assertEqual({observation.observation_type_id for observation in observations}, set(self.type_ids))
        self.assertEqual(len(points), 4)
