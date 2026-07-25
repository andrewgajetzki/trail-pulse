import { lineString } from "@turf/helpers";
import length from "@turf/length";

import type { TripDetail } from "./types.ts";

export type TripMetrics = {
    distanceKm: number;
    averageSpeedKmh: number;
    maximumSpeedKmh: number | null;
    interactionsPerKm: number;
};

export function calculateTripMetrics(
    trip: TripDetail,
): TripMetrics {
    const coordinates = trip.location_points.map((point) => [
        point.longitude,
        point.latitude,
    ]);

    const distanceKm =
        coordinates.length >= 2
            ? length(lineString(coordinates), {
                units: "kilometers",
            })
            : 0;

    const durationHours =
        (trip.ended_at - trip.started_at) / 3_600_000;

    const averageSpeedKmh =
        durationHours > 0 ? distanceKm / durationHours : 0;

    const recordedSpeeds = trip.location_points
        .map((point) => point.speed)
        .filter(
            (speed): speed is number =>
                speed !== null && speed >= 0,
        )
        .map((speed) => speed * 3.6);

    const maximumSpeedKmh =
        recordedSpeeds.length > 0
            ? Math.max(...recordedSpeeds)
            : null;

    const interactionsPerKm =
        distanceKm > 0
            ? trip.interaction_count / distanceKm
            : 0;

    return {
        distanceKm,
        averageSpeedKmh,
        maximumSpeedKmh,
        interactionsPerKm,
    };
}