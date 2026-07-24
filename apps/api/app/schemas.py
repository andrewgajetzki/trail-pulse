from typing import Literal

from pydantic import BaseModel, Field


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
