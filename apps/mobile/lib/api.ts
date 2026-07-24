import * as Location from "expo-location";

export type InteractionType = "Greeted me" | "No response";

export type RecordedInteraction = {
    type: InteractionType;
    latitude: number;
    longitude: number;
    timestamp: number;
};

type SaveTripArguments = {
    startedAt: number;
    endedAt: number;
    locationPoints: Location.LocationObject[];
    interactions: RecordedInteraction[];
};

type SavedTripResponse = {
    id: number;
    location_point_count: number;
    interaction_count: number;
};

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export async function saveTrip({
                                   startedAt,
                                   endedAt,
                                   locationPoints,
                                   interactions,
                               }: SaveTripArguments): Promise<SavedTripResponse> {
    if (!API_URL) {
        throw new Error("EXPO_PUBLIC_API_URL is not configured");
    }

    const response = await fetch(`${API_URL}/trips`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            started_at: startedAt,
            ended_at: endedAt,

            location_points: locationPoints.map((point) => ({
                recorded_at: point.timestamp,
                latitude: point.coords.latitude,
                longitude: point.coords.longitude,
                accuracy: point.coords.accuracy,
                speed: point.coords.speed,
                heading: point.coords.heading,
            })),

            interactions: interactions.map((interaction) => ({
                recorded_at: interaction.timestamp,
                latitude: interaction.latitude,
                longitude: interaction.longitude,
                type: interaction.type,
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