from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, status
from sqlalchemy import func, select, text

from .database import Base, SessionLocal, engine
from .models import Interaction, LocationPoint, Trip
from .schemas import (
    InteractionRead,
    LocationPointRead,
    TripCreate,
    TripCreated,
    TripDetail,
    TripSummary,
)


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

@app.get("/trips", response_model=list[TripSummary])
def list_trips() -> list[TripSummary]:
    with SessionLocal() as session:
        statement = (
            select(
                Trip.id,
                Trip.started_at,
                Trip.ended_at,
                func.count(
                    func.distinct(LocationPoint.id)
                ).label("location_point_count"),
                func.count(
                    func.distinct(Interaction.id)
                ).label("interaction_count"),
            )
            .outerjoin(
                LocationPoint,
                LocationPoint.trip_id == Trip.id,
            )
            .outerjoin(
                Interaction,
                Interaction.trip_id == Trip.id,
            )
            .group_by(Trip.id)
            .order_by(Trip.started_at.desc())
        )

        rows = session.execute(statement).all()

        return [
            TripSummary(
                id=row.id,
                started_at=row.started_at,
                ended_at=row.ended_at,
                location_point_count=row.location_point_count,
                interaction_count=row.interaction_count,
            )
            for row in rows
        ]


@app.get("/trips/{trip_id}", response_model=TripDetail)
def get_trip(trip_id: int) -> TripDetail:
    with SessionLocal() as session:
        trip = session.get(Trip, trip_id)

        if trip is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Trip not found",
            )

        location_points = session.scalars(
            select(LocationPoint)
            .where(LocationPoint.trip_id == trip_id)
            .order_by(LocationPoint.sequence_number)
        ).all()

        interactions = session.scalars(
            select(Interaction)
            .where(Interaction.trip_id == trip_id)
            .order_by(Interaction.recorded_at)
        ).all()

        return TripDetail(
            id=trip.id,
            started_at=trip.started_at,
            ended_at=trip.ended_at,
            location_point_count=len(location_points),
            interaction_count=len(interactions),
            location_points=[
                LocationPointRead(
                    recorded_at=point.recorded_at,
                    sequence_number=point.sequence_number,
                    latitude=point.latitude,
                    longitude=point.longitude,
                    accuracy=point.accuracy,
                    speed=point.speed,
                    heading=point.heading,
                )
                for point in location_points
            ],
            interactions=[
                InteractionRead(
                    recorded_at=interaction.recorded_at,
                    latitude=interaction.latitude,
                    longitude=interaction.longitude,
                    interaction_type=interaction.interaction_type,
                )
                for interaction in interactions
            ],
        )























