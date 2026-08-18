import unittest

from pydantic import ValidationError

from app.schemas import (
    ObservationProfileCreate,
    ObservationTypeCreate,
    ObservationTypeUpdate,
    TripCreate,
)


class ObservationSchemaTests(unittest.TestCase):
    def test_profile_name_is_required_and_trimmed(self) -> None:
        profile = ObservationProfileCreate(name="  Trail Friendliness  ")

        self.assertEqual(profile.name, "Trail Friendliness")

        with self.assertRaises(ValidationError):
            ObservationProfileCreate(name="   ")

    def test_type_requires_label_and_icon(self) -> None:
        with self.assertRaises(ValidationError):
            ObservationTypeCreate(label="", icon="🙂", sort_order=1)

        with self.assertRaises(ValidationError):
            ObservationTypeCreate(label="Greeted us", icon="", sort_order=1)

    def test_type_update_supports_archiving(self) -> None:
        update = ObservationTypeUpdate(is_active=False)

        self.assertFalse(update.is_active)

    def test_trip_requires_profile_and_observation_type_ids(self) -> None:
        with self.assertRaises(ValidationError):
            TripCreate(
                started_at=1,
                ended_at=2,
                location_points=[{"recorded_at": 1, "latitude": 1, "longitude": 1}],
            )

        trip = TripCreate(
            started_at=1,
            ended_at=2,
            observation_profile_id=3,
            location_points=[{"recorded_at": 1, "latitude": 1, "longitude": 1}],
            observations=[
                {"recorded_at": 1, "latitude": 1, "longitude": 1, "observation_type_id": 4},
            ],
        )
        self.assertEqual(trip.observations[0].observation_type_id, 4)
