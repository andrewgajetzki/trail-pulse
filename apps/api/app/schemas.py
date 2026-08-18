from typing import Literal

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class NonBlankNameModel(BaseModel):
    @field_validator("name", "label", "icon", check_fields=False)
    @classmethod
    def require_non_blank_text(cls, value: str | None) -> str | None:
        if value is None:
            raise ValueError("must not be null")
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value


class GoogleAuthRequest(BaseModel):
    id_token: str = Field(min_length=1)


class AuthenticatedUser(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str | None
    name: str
    picture_url: str | None


class GoogleAuthResponse(BaseModel):
    access_token: str
    token_type: str
    user: AuthenticatedUser


class ObservationTypeCreate(NonBlankNameModel):
    label: str = Field(max_length=255)
    icon: str = Field(max_length=32)
    sort_order: int
    is_active: bool = True


class ObservationTypeUpdate(NonBlankNameModel):
    label: str | None = Field(default=None, max_length=255)
    icon: str | None = Field(default=None, max_length=32)
    sort_order: int | None = None
    is_active: bool | None = None


class ObservationTypeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    profile_id: int
    label: str
    icon: str
    sort_order: int
    is_active: bool
    created_at: datetime


class ObservationProfileCreate(NonBlankNameModel):
    name: str = Field(max_length=255)
    is_active: bool = True


class ObservationProfileUpdate(NonBlankNameModel):
    name: str | None = Field(default=None, max_length=255)
    is_active: bool | None = None


class ObservationProfileSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    is_active: bool
    created_at: datetime


class ObservationProfileDetail(ObservationProfileSummary):
    types: list[ObservationTypeRead]


class LocationPointCreate(BaseModel):
    recorded_at: int
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    accuracy: float | None = None
    speed: float | None = None
    heading: float | None = None


class InteractionCreate(BaseModel):
    recorded_at: int
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    type: Literal["Greeted me", "No response"]


class TripCreate(BaseModel):
    started_at: int
    ended_at: int
    location_points: list[LocationPointCreate] = Field(min_length=1)
    interactions: list[InteractionCreate] = Field(default_factory=list)


class TripCreated(BaseModel):
    id: int
    location_point_count: int
    interaction_count: int


class TripSummary(BaseModel):
    id: int
    started_at: int
    ended_at: int
    location_point_count: int
    interaction_count: int


class LocationPointRead(BaseModel):
    recorded_at: int
    sequence_number: int
    latitude: float
    longitude: float
    accuracy: float | None
    speed: float | None
    heading: float | None


class InteractionRead(BaseModel):
    recorded_at: int
    latitude: float
    longitude: float
    interaction_type: str


class TripDetail(TripSummary):
    location_points: list[LocationPointRead]
    interactions: list[InteractionRead]
