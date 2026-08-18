import unittest

from pydantic import ValidationError

from app.schemas import (
    ObservationProfileCreate,
    ObservationTypeCreate,
    ObservationTypeUpdate,
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
