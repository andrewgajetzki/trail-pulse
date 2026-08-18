from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, status
from sqlalchemy import func, select, text

from .auth import create_access_token, get_current_user
from .database import SessionLocal, engine
from .google_auth import GoogleTokenValidationError, verify_google_id_token
from .models import (
    LocationPoint,
    Observation,
    ObservationProfile,
    ObservationType,
    Trip,
    User,
)
from .schemas import (
    AuthenticatedUser,
    GoogleAuthRequest,
    GoogleAuthResponse,
    InteractionRead,
    LocationPointRead,
    TripCreate,
    TripCreated,
    TripDetail,
    TripSummary,
)

app = FastAPI(
    title="Trail Pulse API",
)

DEFAULT_PROFILE_NAME = "Trail Friendliness"
DEFAULT_OBSERVATION_TYPES = (
    ("Greeted us", "🙂", 1),
    ("No response", "😐", 2),
)
LEGACY_TYPE_TO_LABEL = {
    "Greeted me": "Greeted us",
    "No response": "No response",
}


def get_active_observation_profile(session, user_id: int) -> ObservationProfile:
    """Return the user's active profile, creating the default for new users."""
    profile = session.scalar(
        select(ObservationProfile)
        .where(
            ObservationProfile.user_id == user_id,
            ObservationProfile.is_active.is_(True),
        )
        .order_by(ObservationProfile.id)
    )
    if profile is not None:
        return profile

    profile = ObservationProfile(
        user_id=user_id,
        name=DEFAULT_PROFILE_NAME,
        is_active=True,
    )
    session.add(profile)
    session.flush()
    session.add_all(
        ObservationType(
            profile_id=profile.id,
            label=label,
            icon=icon,
            sort_order=sort_order,
            is_active=True,
        )
        for label, icon, sort_order in DEFAULT_OBSERVATION_TYPES
    )
    session.flush()
    return profile

@app.post("/auth/google", response_model=GoogleAuthResponse)
def authenticate_with_google(payload: GoogleAuthRequest) -> GoogleAuthResponse:
    try:
        claims = verify_google_id_token(payload.id_token)
    except GoogleTokenValidationError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google ID token",
        ) from None
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google authentication is not configured",
        ) from None

    google_subject = claims.get("sub")
    name = claims.get("name")
    email = claims.get("email")
    picture_url = claims.get("picture")

    if not isinstance(google_subject, str) or not google_subject:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google ID token")

    if not isinstance(name, str) or not name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Google account does not include a name",
        )

    with SessionLocal.begin() as session:
        user = session.scalar(
            select(User).where(User.google_subject == google_subject),
        )

        if user is None:
            user = User(
                google_subject=google_subject,
                name=name,
                email=email if isinstance(email, str) else None,
                picture_url=picture_url if isinstance(picture_url, str) else None,
            )
            session.add(user)
        else:
            user.name = name
            user.email = email if isinstance(email, str) else None
            user.picture_url = picture_url if isinstance(picture_url, str) else None

        session.flush()
        token = create_access_token(user.id)
        authenticated_user = AuthenticatedUser.model_validate(user)

    return GoogleAuthResponse(
        access_token=token,
        token_type="bearer",
        user=authenticated_user,
    )


@app.get("/auth/me", response_model=AuthenticatedUser)
def get_current_account(user: Annotated[User, Depends(get_current_user)]) -> User:
    return user

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
def create_trip(
    payload: TripCreate,
    user: Annotated[User, Depends(get_current_user)],
) -> TripCreated:
    if payload.ended_at <= payload.started_at:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="ended_at must be later than started_at",
        )

    with SessionLocal.begin() as session:
        profile = get_active_observation_profile(session, user.id)
        trip = Trip(
            started_at=payload.started_at,
            ended_at=payload.ended_at,
            user_id=user.id,
            observation_profile_id=profile.id,
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

        observation_types = {
            observation_type.label: observation_type.id
            for observation_type in session.scalars(
                select(ObservationType).where(ObservationType.profile_id == profile.id),
            )
        }
        observations = [
            Observation(
                trip_id=trip.id,
                recorded_at=interaction.recorded_at,
                latitude=interaction.latitude,
                longitude=interaction.longitude,
                observation_type_id=observation_types[
                    LEGACY_TYPE_TO_LABEL[interaction.type]
                ],
                interaction_type=interaction.type,
            )
            for interaction in payload.interactions
        ]

        session.add_all(location_points)
        session.add_all(observations)

        trip_id = trip.id

    return TripCreated(
        id=trip_id,
        location_point_count=len(location_points),
        interaction_count=len(observations),
    )

@app.get("/trips", response_model=list[TripSummary])
def list_trips(
    user: Annotated[User, Depends(get_current_user)],
) -> list[TripSummary]:
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
                    func.distinct(Observation.id)
                ).label("interaction_count"),
            )
            .outerjoin(
                LocationPoint,
                LocationPoint.trip_id == Trip.id,
            )
            .outerjoin(
                Observation,
                Observation.trip_id == Trip.id,
            )
            .where(Trip.user_id == user.id)
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
def get_trip(
    trip_id: int,
    user: Annotated[User, Depends(get_current_user)],
) -> TripDetail:
    with SessionLocal() as session:
        trip = session.scalar(
            select(Trip).where(Trip.id == trip_id, Trip.user_id == user.id),
        )

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

        observations = session.scalars(
            select(Observation)
            .where(Observation.trip_id == trip_id)
            .order_by(Observation.recorded_at)
        ).all()

        return TripDetail(
            id=trip.id,
            started_at=trip.started_at,
            ended_at=trip.ended_at,
            location_point_count=len(location_points),
            interaction_count=len(observations),
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
                    recorded_at=observation.recorded_at,
                    latitude=observation.latitude,
                    longitude=observation.longitude,
                    interaction_type=observation.interaction_type,
                )
                for observation in observations
            ],
        )
















