from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, Float, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    google_subject: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        nullable=True,
    )
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    name: Mapped[str] = mapped_column(String(255))
    picture_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    trips: Mapped[list["Trip"]] = relationship(back_populates="user")
    observation_profiles: Mapped[list["ObservationProfile"]] = relationship(
        back_populates="user",
    )


class ObservationProfile(Base):
    __tablename__ = "observation_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(),
    )

    user: Mapped[User] = relationship(back_populates="observation_profiles")
    observation_types: Mapped[list["ObservationType"]] = relationship(
        back_populates="profile",
    )


class ObservationType(Base):
    __tablename__ = "observation_types"

    id: Mapped[int] = mapped_column(primary_key=True)
    profile_id: Mapped[int] = mapped_column(
        ForeignKey("observation_profiles.id", ondelete="CASCADE"),
        index=True,
    )
    label: Mapped[str] = mapped_column(String(255))
    icon: Mapped[str] = mapped_column(String(32))
    sort_order: Mapped[int]
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(),
    )

    profile: Mapped[ObservationProfile] = relationship(back_populates="observation_types")


class Trip(Base):
    __tablename__ = "trips"

    id: Mapped[int] = mapped_column(primary_key=True)
    started_at: Mapped[int] = mapped_column(BigInteger)
    ended_at: Mapped[int] = mapped_column(BigInteger)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        index=True,
    )
    observation_profile_id: Mapped[int] = mapped_column(
        ForeignKey("observation_profiles.id", ondelete="RESTRICT"),
        index=True,
    )

    user: Mapped[User] = relationship(back_populates="trips")


class LocationPoint(Base):
    __tablename__ = "location_points"

    id: Mapped[int] = mapped_column(primary_key=True)
    trip_id: Mapped[int] = mapped_column(
        ForeignKey("trips.id", ondelete="CASCADE"),
        index=True,
    )
    recorded_at: Mapped[int] = mapped_column(BigInteger)
    sequence_number: Mapped[int]
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    speed: Mapped[float | None] = mapped_column(Float, nullable=True)
    heading: Mapped[float | None] = mapped_column(Float, nullable=True)


class Observation(Base):
    __tablename__ = "observations"

    id: Mapped[int] = mapped_column(primary_key=True)
    trip_id: Mapped[int] = mapped_column(
        ForeignKey("trips.id", ondelete="CASCADE"),
        index=True,
    )
    recorded_at: Mapped[int] = mapped_column(BigInteger)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    observation_type_id: Mapped[int] = mapped_column(
        ForeignKey("observation_types.id", ondelete="RESTRICT"),
        index=True,
    )
    # Retained temporarily to verify the backfill before a future removal.
    interaction_type: Mapped[str] = mapped_column(String(30))
