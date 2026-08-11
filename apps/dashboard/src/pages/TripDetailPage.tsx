import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import Map, {
    Marker,
    NavigationControl,
    Popup
} from "react-map-gl/maplibre";
import type { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { calculateTripMetrics } from "../tripMetrics";
import { getTrip } from "../api";
import type {
    Interaction,
    LocationPoint,
    TripDetail,
} from "../types";

type Bounds = [
    [number, number],
    [number, number],
];

function getRouteBounds(points: LocationPoint[]): Bounds {
    const longitudes = points.map((point) => point.longitude);
    const latitudes = points.map((point) => point.latitude);

    return [
        [Math.min(...longitudes), Math.min(...latitudes)],
        [Math.max(...longitudes), Math.max(...latitudes)],
    ];
}

function formatDuration(trip: TripDetail): string {
    const seconds = Math.round(
        (trip.ended_at - trip.started_at) / 1000,
    );

    if (seconds < 60) {
        return `${seconds} sec`;
    }

    return `${Math.round(seconds / 60)} min`;
}

function TripDetailPage() {
    const { tripId } = useParams();
    const numericTripId = Number(tripId);

    const [selectedInteraction, setSelectedInteraction] =
        useState<Interaction | null>(null);

    const tripQuery = useQuery({
        queryKey: ["trip", numericTripId],
        queryFn: () => getTrip(numericTripId),
        enabled:
            Number.isInteger(numericTripId) &&
            numericTripId > 0,
    });

    if (tripQuery.isPending) {
        return (
            <main className="page">
                <p>Loading ride...</p>
            </main>
        );
    }

    if (tripQuery.isError) {
        return (
            <main className="page">
                <Link className="back-link" to="/">
                    ← Ride history
                </Link>

                <p className="error">
                    {tripQuery.error instanceof Error
                        ? tripQuery.error.message
                        : "Could not load ride."}
                </p>
            </main>
        );
    }

    const trip = tripQuery.data;
    const metrics = calculateTripMetrics(trip);
    const greetedCount = trip.interactions.filter(
        (interaction) =>
            interaction.interaction_type === "Greeted me",
    ).length;

    const noResponseCount =
        trip.interactions.length - greetedCount;

    const responsePercentage =
        trip.interactions.length === 0
            ? 0
            : Math.round(
                (greetedCount / trip.interactions.length) * 100,
            );

    const routeGeoJson = {
        type: "Feature" as const,
        properties: {},
        geometry: {
            type: "LineString" as const,
            coordinates: trip.location_points.map((point) => [
                point.longitude,
                point.latitude,
            ]),
        },
    };

    const mapStyle: StyleSpecification = {
        version: 8,
        sources: {
            openStreetMap: {
                type: "raster",
                tiles: [
                    "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
                ],
                tileSize: 256,
                attribution: "© OpenStreetMap contributors",
            },

            rideRoute: {
                type: "geojson",
                data: routeGeoJson,
            },
        },

        layers: [
            {
                id: "openStreetMap",
                type: "raster",
                source: "openStreetMap",
            },

            {
                id: "ride-route-outline",
                type: "line",
                source: "rideRoute",
                layout: {
                    "line-cap": "round",
                    "line-join": "round",
                },
                paint: {
                    "line-color": "#ffffff",
                    "line-width": 12,
                    "line-opacity": 0.95,
                },
            },

            {
                id: "ride-route-line",
                type: "line",
                source: "rideRoute",
                layout: {
                    "line-cap": "round",
                    "line-join": "round",
                },
                paint: {
                    "line-color": "#0066ff",
                    "line-width": 7,
                    "line-opacity": 1,
                },
            },
        ],
    };

    const firstPoint = trip.location_points[0];
    const finalPoint =
        trip.location_points[trip.location_points.length - 1];

    return (
        <main className="page ride-detail-page">
            <Link className="back-link" to="/">
                ← Ride history
            </Link>

            <header className="ride-header">
                <div>
                    <p className="eyebrow">Trail Pulse</p>

                    <h1>
                        {new Date(trip.started_at).toLocaleDateString()}
                    </h1>

                    <p className="subtitle">
                        Started{" "}
                        {new Date(trip.started_at).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                        })}
                    </p>
                </div>
            </header>

            <section className="ride-stats">
                <article>
                    <span>Duration</span>
                    <strong>{formatDuration(trip)}</strong>
                </article>
                <article>
                    <span>Distance</span>
                    <strong>{metrics.distanceKm.toFixed(1)} km</strong>
                </article>

                <article>
                    <span>Average speed</span>
                    <strong>
                        {metrics.averageSpeedKmh.toFixed(1)} km/h
                    </strong>
                </article>

                <article>
                    <span>Maximum speed</span>
                    <strong>
                        {metrics.maximumSpeedKmh === null
                            ? "Unavailable"
                            : `${metrics.maximumSpeedKmh.toFixed(1)} km/h`}
                    </strong>
                </article>
                <article>
                    <span>Interactions</span>
                    <strong>{trip.interaction_count}</strong>
                </article>

                <article>
                    <span>Greeted</span>
                    <strong>{greetedCount}</strong>
                </article>

                <article>
                    <span>No response</span>
                    <strong>{noResponseCount}</strong>
                </article>

                <article>
                    <span>Greeting rate</span>
                    <strong>{responsePercentage}%</strong>
                </article>


                <article>
                    <span>Interactions/km</span>
                    <strong>
                        {metrics.interactionsPerKm.toFixed(1)}
                    </strong>
                </article>
            </section>

            <section className="map-container">
                <Map
                    initialViewState={{
                        bounds: getRouteBounds(trip.location_points),
                        fitBoundsOptions: {
                            padding: 60,
                            maxZoom: 16,
                        },
                    }}
                    mapStyle={mapStyle}
                    dragPan={true}
                    scrollZoom={true}
                    doubleClickZoom={true}
                    touchZoomRotate={true}
                    keyboard={true}
                    style={{
                        width: "100%",
                        height: "100%",
                    }}
                >
                    <NavigationControl position="top-right" />


                    <Marker
                        longitude={firstPoint.longitude}
                        latitude={firstPoint.latitude}
                        anchor="center"
                    >
            <span className="endpoint-marker start-marker">
              S
            </span>
                    </Marker>

                    <Marker
                        longitude={finalPoint.longitude}
                        latitude={finalPoint.latitude}
                        anchor="center"
                    >
            <span className="endpoint-marker end-marker">
              E
            </span>
                    </Marker>

                    {trip.interactions.map((interaction, index) => (
                        <Marker
                            key={`${interaction.recorded_at}-${index}`}
                            longitude={interaction.longitude}
                            latitude={interaction.latitude}
                            anchor="center"
                        >
                            <button
                                className="interaction-marker"
                                type="button"
                                aria-label={interaction.interaction_type}
                                onClick={() =>
                                    setSelectedInteraction(interaction)
                                }
                            >
                                {interaction.interaction_type === "Greeted me"
                                    ? "🙂"
                                    : "😐"}
                            </button>
                        </Marker>
                    ))}

                    {selectedInteraction && (
                        <Popup
                            longitude={selectedInteraction.longitude}
                            latitude={selectedInteraction.latitude}
                            anchor="bottom"
                            offset={24}
                            onClose={() => setSelectedInteraction(null)}
                        >
                            <strong>
                                {selectedInteraction.interaction_type}
                            </strong>

                            <div>
                                {new Date(
                                    selectedInteraction.recorded_at,
                                ).toLocaleTimeString([], {
                                    hour: "numeric",
                                    minute: "2-digit",
                                    second: "2-digit",
                                })}
                            </div>
                        </Popup>
                    )}
                </Map>
            </section>
        </main>
    );
}

export default TripDetailPage;