import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker, Polyline, Region } from "react-native-maps";

import { getTrip, TripDetail } from "../../lib/api";
import { useAuth } from "../../providers/auth-provider";

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTrip = useCallback(async () => {
    const tripId = Number(id);

    if (!Number.isInteger(tripId) || tripId < 1) {
      setError("This ride link is invalid.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (!session) {
        throw new Error("Sign in is required to load this ride.");
      }

      setTrip(await getTrip(tripId, session.access_token));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "The ride could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [id, session]);

  useEffect(() => {
    void loadTrip();
  }, [loadTrip]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.muted}>Loading ride...</Text>
      </View>
    );
  }

  if (error || !trip) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Couldn’t load ride</Text>
        <Text style={styles.muted}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={() => void loadTrip()}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const durationMinutes = Math.max(1, Math.round((trip.ended_at - trip.started_at) / 60000));
  const metrics = calculateTripMetrics(trip);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>TRAIL PULSE</Text>
      <Text style={styles.title}>{new Date(trip.started_at).toLocaleDateString()}</Text>
      <Text style={styles.subtitle}>
        Started {new Date(trip.started_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
      </Text>

      <View style={styles.statsGrid}>
        <Stat label="Duration" value={`${durationMinutes} min`} />
        <Stat label="Distance" value={`${metrics.distanceKm.toFixed(1)} km`} />
        <Stat label="Average speed" value={`${metrics.averageSpeedKmh.toFixed(1)} km/h`} />
        <Stat
          label="Maximum speed"
          value={metrics.maximumSpeedKmh === null ? "Unavailable" : `${metrics.maximumSpeedKmh.toFixed(1)} km/h`}
        />
        <Stat label="Interactions" value={String(trip.interaction_count)} />
        <Stat label="Profile" value={trip.observation_profile_name} />
        <Stat label="Interactions/km" value={metrics.interactionsPerKm.toFixed(1)} />
      </View>

      <RideMap trip={trip} />

    </ScrollView>
  );
}

function RideMap({ trip }: { trip: TripDetail }) {
  const coordinates = trip.location_points.map((point) => ({
    latitude: point.latitude,
    longitude: point.longitude,
  }));

  if (coordinates.length === 0) {
    return (
      <View style={[styles.map, styles.mapUnavailable]}>
        <Text style={styles.muted}>No GPS points were recorded for this ride.</Text>
      </View>
    );
  }

  const initialRegion = getRouteRegion(coordinates);
  const firstPoint = coordinates[0];
  const finalPoint = coordinates[coordinates.length - 1];

  return (
    <View style={styles.mapContainer}>
      <MapView
        style={styles.map}
        initialRegion={initialRegion}
        accessibilityLabel="Map of the recorded ride"
      >
        {coordinates.length > 1 ? (
          <Polyline
            coordinates={coordinates}
            strokeColor="#087f5b"
            strokeWidth={5}
          />
        ) : null}

        <Marker coordinate={firstPoint} title="Ride start" anchor={{ x: 0.5, y: 0.5 }}>
          <View style={[styles.endpointMarker, styles.startMarker]}>
            <Text style={styles.endpointText}>S</Text>
          </View>
        </Marker>

        <Marker coordinate={finalPoint} title="Ride finish" anchor={{ x: 0.5, y: 0.5 }}>
          <View style={[styles.endpointMarker, styles.finishMarker]}>
            <Text style={styles.endpointText}>E</Text>
          </View>
        </Marker>

        {trip.observations.map((observation, index) => (
          <Marker
            key={`${observation.recorded_at}-${index}`}
            coordinate={{
              latitude: observation.latitude,
              longitude: observation.longitude,
            }}
            title={observation.observation_type_label}
            description={new Date(observation.recorded_at).toLocaleTimeString()}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.interactionMarker}>
              <Text style={styles.interactionEmoji}>
                {observation.observation_type_icon}
              </Text>
            </View>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}

function getRouteRegion(coordinates: { latitude: number; longitude: number }[]): Region {
  const latitudes = coordinates.map((coordinate) => coordinate.latitude);
  const longitudes = coordinates.map((coordinate) => coordinate.longitude);
  const minimumLatitude = Math.min(...latitudes);
  const maximumLatitude = Math.max(...latitudes);
  const minimumLongitude = Math.min(...longitudes);
  const maximumLongitude = Math.max(...longitudes);

  return {
    latitude: (minimumLatitude + maximumLatitude) / 2,
    longitude: (minimumLongitude + maximumLongitude) / 2,
    latitudeDelta: Math.max((maximumLatitude - minimumLatitude) * 1.5, 0.01),
    longitudeDelta: Math.max((maximumLongitude - minimumLongitude) * 1.5, 0.01),
  };
}

function calculateTripMetrics(trip: TripDetail) {
  let distanceKm = 0;

  for (let index = 1; index < trip.location_points.length; index += 1) {
    const previous = trip.location_points[index - 1];
    const current = trip.location_points[index];
    distanceKm += distanceBetween(previous.latitude, previous.longitude, current.latitude, current.longitude);
  }

  const durationHours = (trip.ended_at - trip.started_at) / 3_600_000;
  const speeds = trip.location_points
    .map((point) => point.speed)
    .filter((speed): speed is number => speed !== null && speed >= 0)
    .map((speed) => speed * 3.6);

  return {
    distanceKm,
    averageSpeedKmh: durationHours > 0 ? distanceKm / durationHours : 0,
    maximumSpeedKmh: speeds.length ? Math.max(...speeds) : null,
    interactionsPerKm: distanceKm > 0 ? trip.interaction_count / distanceKm : 0,
  };
}

function distanceBetween(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(lat2 - lat1);
  const longitudeDelta = toRadians(lon2 - lon1);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(longitudeDelta / 2) ** 2;

  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingBottom: 48, backgroundColor: "#f4f6f5" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  eyebrow: { color: "#17202a", fontWeight: "700", letterSpacing: 1.5, marginBottom: 4 },
  title: { fontSize: 36, fontWeight: "bold", color: "#17202a" },
  subtitle: { fontSize: 16, color: "#5d6d65", marginTop: 8, marginBottom: 32 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statCard: { width: "48%", padding: 16, borderRadius: 12, backgroundColor: "white", borderWidth: 1, borderColor: "#d7dfda" },
  statLabel: { color: "#5d6d65", marginBottom: 6 },
  statValue: { fontSize: 20, fontWeight: "700", color: "#17202a" },
  mapContainer: { height: 500, marginTop: 20, overflow: "hidden", borderWidth: 1, borderColor: "#d7dfda", borderRadius: 16, backgroundColor: "white" },
  map: { width: "100%", height: "100%" },
  mapUnavailable: { height: 220, alignItems: "center", justifyContent: "center", padding: 24 },
  endpointMarker: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "white", borderRadius: 15, shadowColor: "black", shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
  startMarker: { backgroundColor: "#087f5b" },
  finishMarker: { backgroundColor: "#c92a2a" },
  endpointText: { color: "white", fontSize: 12, fontWeight: "800" },
  interactionMarker: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "white", borderRadius: 20, backgroundColor: "white", shadowColor: "black", shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
  interactionEmoji: { fontSize: 23 },
  sectionTitle: { fontSize: 20, fontWeight: "700", marginTop: 28, marginBottom: 12 },
  interactionCard: { flexDirection: "row", justifyContent: "space-between", padding: 18, marginBottom: 10, borderRadius: 12, backgroundColor: "white", borderWidth: 1, borderColor: "#d7dfda" },
  interactionText: { fontSize: 16 },
  interactionCount: { fontSize: 17, fontWeight: "700" },
  muted: { color: "#64748b", textAlign: "center", marginTop: 10 },
  errorTitle: { fontSize: 20, fontWeight: "700" },
  retryButton: { marginTop: 18, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, backgroundColor: "#15803d" },
  retryText: { color: "white", fontWeight: "600" },
});
