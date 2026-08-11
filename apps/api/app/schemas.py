from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


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
