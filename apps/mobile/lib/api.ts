import * as Location from "expo-location";

export type ObservationType = {
    id: number;
    profile_id: number;
    label: string;
    icon: string;
    sort_order: number;
    is_active: boolean;
};

export type ObservationProfile = {
    id: number;
    name: string;
    is_active: boolean;
};

export type ObservationProfileDetail = ObservationProfile & {
    types: ObservationType[];
};

export type RecordedObservation = {
    observationTypeId: number;
    latitude: number;
    longitude: number;
    timestamp: number;
};

type SaveTripArguments = {
    startedAt: number;
    endedAt: number;
    locationPoints: Location.LocationObject[];
    observationProfileId: number;
    observations: RecordedObservation[];
    accessToken: string;
};

type SavedTripResponse = {
    id: number;
    location_point_count: number;
    interaction_count: number;
};

export type TripSummary = {
    id: number;
    started_at: number;
    ended_at: number;
    location_point_count: number;
    interaction_count: number;
};

export type LocationPoint = {
    recorded_at: number;
    sequence_number: number;
    latitude: number;
    longitude: number;
    accuracy: number | null;
    speed: number | null;
    heading: number | null;
};

export type TripObservation = {
    recorded_at: number;
    latitude: number;
    longitude: number;
    observation_type_id: number;
    observation_type_label: string;
    observation_type_icon: string;
};

export type TripDetail = TripSummary & {
    observation_profile_id: number;
    observation_profile_name: string;
    location_points: LocationPoint[];
    observations: TripObservation[];
};

export type AuthenticatedUser = {
    id: number;
    email: string | null;
    name: string;
    picture_url: string | null;
};

export type AuthSession = {
    access_token: string;
    token_type: "bearer";
    user: AuthenticatedUser;
};

const API_URL = process.env.EXPO_PUBLIC_API_URL;

function getApiUrl() {
    if (!API_URL) {
        throw new Error("EXPO_PUBLIC_API_URL is not configured");
    }

    return API_URL;
}

export async function signInWithGoogle(idToken: string): Promise<AuthSession> {
    const response = await fetch(`${getApiUrl()}/auth/google`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ id_token: idToken }),
    });

    if (!response.ok) {
        throw new Error(`Google sign-in failed: ${response.status}`);
    }

    return response.json();
}

function authorizationHeaders(accessToken: string) {
    return { Authorization: `Bearer ${accessToken}` };
}

export async function getTrips(accessToken: string): Promise<TripSummary[]> {
    const response = await fetch(`${getApiUrl()}/trips`, {
        headers: authorizationHeaders(accessToken),
    });

    if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
    }

    const trips: TripSummary[] = await response.json();

    return trips.sort((a, b) => b.started_at - a.started_at);
}

export async function getObservationProfiles(accessToken: string): Promise<ObservationProfile[]> {
    const response = await fetch(`${getApiUrl()}/observation-profiles`, {
        headers: authorizationHeaders(accessToken),
    });
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    return response.json();
}

export async function getObservationProfile(profileId: number, accessToken: string): Promise<ObservationProfileDetail> {
    const response = await fetch(`${getApiUrl()}/observation-profiles/${profileId}`, {
        headers: authorizationHeaders(accessToken),
    });
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    return response.json();
}

export async function getTrip(tripId: number, accessToken: string): Promise<TripDetail> {
    const response = await fetch(`${getApiUrl()}/trips/${tripId}`, {
        headers: authorizationHeaders(accessToken),
    });

    if (response.status === 404) {
        throw new Error("Ride not found");
    }

    if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
    }

    return response.json();
}

export async function saveTrip({
                                   startedAt,
                                   endedAt,
                                   locationPoints,
                                   observationProfileId,
                                   observations,
                                   accessToken,
                               }: SaveTripArguments): Promise<SavedTripResponse> {
    const response = await fetch(`${getApiUrl()}/trips`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...authorizationHeaders(accessToken),
        },
        body: JSON.stringify({
            started_at: startedAt,
            ended_at: endedAt,
            observation_profile_id: observationProfileId,

            location_points: locationPoints.map((point) => ({
                recorded_at: point.timestamp,
                latitude: point.coords.latitude,
                longitude: point.coords.longitude,
                accuracy: point.coords.accuracy,
                speed: point.coords.speed,
                heading: point.coords.heading,
            })),

            observations: observations.map((observation) => ({
                recorded_at: observation.timestamp,
                latitude: observation.latitude,
                longitude: observation.longitude,
                observation_type_id: observation.observationTypeId,
            })),
        }),
    });

    if (!response.ok) {
        const responseBody = await response.text();

        throw new Error(
            `API returned ${response.status}: ${responseBody}`,
        );
    }

    return response.json();
}
