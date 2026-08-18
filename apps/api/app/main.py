from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, status
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError

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
    LocationPointRead,
    ObservationRead,
    ObservationProfileCreate,
    ObservationProfileDetail,
    ObservationProfileSummary,
    ObservationProfileUpdate,
    ObservationTypeCreate,
    ObservationTypeRead,
    ObservationTypeUpdate,
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


def get_owned_profile(session, profile_id: int, user_id: int) -> ObservationProfile:
    profile = session.scalar(
        select(ObservationProfile).where(
            ObservationProfile.id == profile_id,
            ObservationProfile.user_id == user_id,
        ),
    )
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Observation profile not found")
    return profile


def get_profile_types(session, profile_id: int) -> list[ObservationType]:
    return session.scalars(
        select(ObservationType)
        .where(ObservationType.profile_id == profile_id)
        .order_by(ObservationType.sort_order, ObservationType.id),
    ).all()


def observation_profile_detail(session, profile: ObservationProfile) -> ObservationProfileDetail:
    return ObservationProfileDetail(
        id=profile.id,
        name=profile.name,
        is_active=profile.is_active,
        created_at=profile.created_at,
        types=[ObservationTypeRead.model_validate(item) for item in get_profile_types(session, profile.id)],
    )

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
        get_active_observation_profile(session, user.id)
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


@app.get("/observation-profiles", response_model=list[ObservationProfileSummary])
def list_observation_profiles(
    user: Annotated[User, Depends(get_current_user)],
) -> list[ObservationProfileSummary]:
    with SessionLocal() as session:
        profiles = session.scalars(
            select(ObservationProfile)
            .where(ObservationProfile.user_id == user.id)
            .order_by(ObservationProfile.is_active.desc(), ObservationProfile.name, ObservationProfile.id),
        ).all()
        return [ObservationProfileSummary.model_validate(profile) for profile in profiles]


@app.post(
    "/observation-profiles",
    response_model=ObservationProfileDetail,
    status_code=status.HTTP_201_CREATED,
)
def create_observation_profile(
    payload: ObservationProfileCreate,
    user: Annotated[User, Depends(get_current_user)],
) -> ObservationProfileDetail:
    try:
        with SessionLocal.begin() as session:
            profile = ObservationProfile(
                user_id=user.id,
                name=payload.name,
                is_active=payload.is_active,
            )
            session.add(profile)
            session.flush()
            session.refresh(profile)
            return observation_profile_detail(session, profile)
    except IntegrityError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Observation profile name already exists") from None


@app.get("/observation-profiles/{profile_id}", response_model=ObservationProfileDetail)
def get_observation_profile(
    profile_id: int,
    user: Annotated[User, Depends(get_current_user)],
) -> ObservationProfileDetail:
    with SessionLocal() as session:
        return observation_profile_detail(session, get_owned_profile(session, profile_id, user.id))


@app.patch("/observation-profiles/{profile_id}", response_model=ObservationProfileDetail)
def update_observation_profile(
    profile_id: int,
    payload: ObservationProfileUpdate,
    user: Annotated[User, Depends(get_current_user)],
) -> ObservationProfileDetail:
    try:
        with SessionLocal.begin() as session:
            profile = get_owned_profile(session, profile_id, user.id)
            for field, value in payload.model_dump(exclude_unset=True).items():
                setattr(profile, field, value)
            session.flush()
            session.refresh(profile)
            return observation_profile_detail(session, profile)
    except IntegrityError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Observation profile name already exists") from None


@app.post(
    "/observation-profiles/{profile_id}/types",
    response_model=ObservationTypeRead,
    status_code=status.HTTP_201_CREATED,
)
def create_observation_type(
    profile_id: int,
    payload: ObservationTypeCreate,
    user: Annotated[User, Depends(get_current_user)],
) -> ObservationTypeRead:
    try:
        with SessionLocal.begin() as session:
            get_owned_profile(session, profile_id, user.id)
            observation_type = ObservationType(profile_id=profile_id, **payload.model_dump())
            session.add(observation_type)
            session.flush()
            session.refresh(observation_type)
            return ObservationTypeRead.model_validate(observation_type)
    except IntegrityError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Observation type label already exists") from None


@app.patch("/observation-types/{observation_type_id}", response_model=ObservationTypeRead)
def update_observation_type(
    observation_type_id: int,
    payload: ObservationTypeUpdate,
    user: Annotated[User, Depends(get_current_user)],
) -> ObservationTypeRead:
    try:
        with SessionLocal.begin() as session:
            observation_type = session.scalar(
                select(ObservationType)
                .join(ObservationProfile)
                .where(
                    ObservationType.id == observation_type_id,
                    ObservationProfile.user_id == user.id,
                ),
            )
            if observation_type is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Observation type not found")
            for field, value in payload.model_dump(exclude_unset=True).items():
                setattr(observation_type, field, value)
            session.flush()
            session.refresh(observation_type)
            return ObservationTypeRead.model_validate(observation_type)
    except IntegrityError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Observation type label already exists") from None


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
        profile = get_owned_profile(session, payload.observation_profile_id, user.id)
        trip = Trip(
            started_at=payload.started_at,
            ended_at=payload.ended_at,
            user_id=user.id,
            observation_profile_id=payload.observation_profile_id,
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

        observation_type_ids = {item.observation_type_id for item in payload.observations}
        observation_types = {
            observation_type.id: observation_type
            for observation_type in session.scalars(
                select(ObservationType).where(
                    ObservationType.profile_id == profile.id,
                    ObservationType.is_active.is_(True),
                    ObservationType.id.in_(observation_type_ids),
                ),
            )
        }
        if set(observation_types) != observation_type_ids:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Observations must use active types from the selected profile",
            )
        observations = [
            Observation(
                trip_id=trip.id,
                recorded_at=observation.recorded_at,
                latitude=observation.latitude,
                longitude=observation.longitude,
                observation_type_id=observation.observation_type_id,
                # Retained legacy column; derive its value from the configured type.
                interaction_type=observation_types[observation.observation_type_id].label,
            )
            for observation in payload.observations
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
                Trip.observation_profile_id,
                ObservationProfile.name.label("observation_profile_name"),
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
            .join(
                ObservationProfile,
                ObservationProfile.id == Trip.observation_profile_id,
            )
            .where(Trip.user_id == user.id)
            .group_by(Trip.id, ObservationProfile.name)
            .order_by(Trip.started_at.desc())
        )

        rows = session.execute(statement).all()

        return [
            TripSummary(
                id=row.id,
                started_at=row.started_at,
                ended_at=row.ended_at,
                observation_profile_id=row.observation_profile_id,
                observation_profile_name=row.observation_profile_name,
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

        observations = session.execute(
            select(Observation, ObservationType)
            .join(ObservationType)
            .where(Observation.trip_id == trip_id)
            .order_by(Observation.recorded_at)
        ).all()

        return TripDetail(
            id=trip.id,
            started_at=trip.started_at,
            ended_at=trip.ended_at,
            observation_profile_id=trip.observation_profile_id,
            observation_profile_name=session.scalar(
                select(ObservationProfile.name).where(
                    ObservationProfile.id == trip.observation_profile_id,
                ),
            ),
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
            observations=[
                ObservationRead(
                    recorded_at=observation.recorded_at,
                    latitude=observation.latitude,
                    longitude=observation.longitude,
                    observation_type_id=observation_type.id,
                    observation_type_label=observation_type.label,
                    observation_type_icon=observation_type.icon,
                )
                for observation, observation_type in observations
            ],
        )











