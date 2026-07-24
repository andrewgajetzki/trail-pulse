from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, status
from sqlalchemy import text

from .database import Base, SessionLocal, engine
from .models import Interaction, LocationPoint, Trip
from .schemas import TripCreate, TripCreated


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Trail Pulse API",
    lifespan=lifespan,
)


@app.get("/health")
def health_check() -> dict[str, str]:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))

    return {
        "status": "ok",
        "database": "connected",
    }


@app.post(
    "/trips",
    response_model=TripCreated,
    status_code=status.HTTP_201_CREATED,
)
def create_trip(payload: TripCreate) -> TripCreated:
    if payload.ended_at <= payload.started_at:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="ended_at must be later than started_at",
        )

    with SessionLocal.begin() as session:
        trip = Trip(
            started_at=payload.started_at,
            ended_at=payload.ended_at,
        )

        session.add(trip)
        session.flush()

        location_points = [
            LocationPoint(
                trip_id=trip.id,
                sequence_number=index,
                recorded_at=point.recorded_at,
                latitude=point.latitude,
                longitude=point.longitude,
                accuracy=point.accuracy,
                speed=point.speed,
                heading=point.heading,
            )
            for index, point in enumerate(payload.location_points)
        ]

        interactions = [
            Interaction(
                trip_id=trip.id,
                recorded_at=interaction.recorded_at,
                latitude=interaction.latitude,
                longitude=interaction.longitude,
                interaction_type=interaction.type,
            )
            for interaction in payload.interactions
        ]

        session.add_all(location_points)
        session.add_all(interactions)

        trip_id = trip.id

    return TripCreated(
        id=trip_id,
        location_point_count=len(location_points),
        interaction_count=len(interactions),
    )

























