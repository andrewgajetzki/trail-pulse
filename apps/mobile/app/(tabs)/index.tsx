import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Location from "expo-location";

import {
  getObservationProfile,
  getObservationProfiles,
  ObservationProfileDetail,
  ObservationType,
  saveTrip,
} from "../../lib/api";
import { useAuth } from "../../providers/auth-provider";

import {
  getSavedRideCount,
  initializeDatabase,
} from "../../lib/database";

type RecordedObservation = {
  observationTypeId: number;
  latitude: number;
  longitude: number;
  timestamp: number;
};

export default function HomeScreen() {
  const { session } = useAuth();
  const [rideActive, setRideActive] = useState(false);
  const [locationPoints, setLocationPoints] = useState<
      Location.LocationObject[]
  >([]);
  const [currentLocation, setCurrentLocation] =
      useState<Location.LocationObject | null>(null);
  const [observations, setObservations] = useState<RecordedObservation[]>([]);
  const [observationProfile, setObservationProfile] = useState<ObservationProfileDetail | null>(null);

  const locationSubscription =
      useRef<Location.LocationSubscription | null>(null);

  const [rideStartedAt, setRideStartedAt] = useState<number | null>(null);
  const [savedRideCount, setSavedRideCount] = useState(0);
  const [saving, setSaving] = useState(false);


  useEffect(() => {
    initializeDatabase()
        .then(getSavedRideCount)
        .then(setSavedRideCount)
        .catch((error) => {
          console.error("Database initialization failed:", error);
        });

    return () => {
      locationSubscription.current?.remove();
    };

  }, []);

  useEffect(() => {
    if (!session) return;

    getObservationProfiles(session.access_token)
      .then((profiles) => profiles.find((profile) => profile.is_active) ?? profiles[0])
      .then((profile) => profile ? getObservationProfile(profile.id, session.access_token) : null)
      .then(setObservationProfile)
      .catch((error) => console.error("Could not load observation profile:", error));
  }, [session]);

  async function startRide() {
    if (!observationProfile) {
      Alert.alert("Observation profile unavailable", "Please wait for your observation profile to load.");
      return;
    }
    const permission =
        await Location.requestForegroundPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Location permission is required");
      return;
    }

    setLocationPoints([]);
    setObservations([]);
    setRideStartedAt(Date.now());
    setRideActive(true);

    const firstLocation = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    setCurrentLocation(firstLocation);
    setLocationPoints([firstLocation]);

    locationSubscription.current =
        await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              timeInterval: 10000,
              distanceInterval: 10,
            },
            (location) => {
              setCurrentLocation(location);
              setLocationPoints((points) => [...points, location]);
            },
        );
  }

  async function stopRide() {
    if (!rideStartedAt || saving) {
      return;
    }

    if (!session || !observationProfile) {
      Alert.alert("Observation profile unavailable", "Please wait for your observation profile to load.");
      return;
    }

    locationSubscription.current?.remove();
    locationSubscription.current = null;

    setSaving(true);

    try {
      const savedTrip = await saveTrip({
        startedAt: rideStartedAt,
        endedAt: Date.now(),
        locationPoints,
        observationProfileId: observationProfile.id,
        observations,
        accessToken: session.access_token,
      });

      setRideActive(false);
      setRideStartedAt(null);

      Alert.alert(
          "Ride saved",
          `Trip ${savedTrip.id} saved with ${savedTrip.location_point_count} GPS points and ${savedTrip.interaction_count} interactions.`,
      );
    } catch (error) {
      console.error("Ride upload failed:", error);

      Alert.alert(
          "Save failed",
          error instanceof Error
              ? error.message
              : "The ride could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  function recordObservation(observationType: ObservationType) {
    if (!rideActive) {
      Alert.alert("Start a ride first");
      return;
    }

    if (!currentLocation) {
      Alert.alert("Waiting for GPS location");
      return;
    }

    setObservations((current) => [
      ...current,
      {
        observationTypeId: observationType.id,
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        timestamp: Date.now(),
      },
    ]);
  }

  return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Trail Pulse</Text>

        <Text style={styles.status}>
          {rideActive ? "Ride in progress" : "No active ride"}
        </Text>

        <Text style={styles.details}>
          GPS points: {locationPoints.length}
        </Text>

        <Text style={styles.details}>
          Observations: {observations.length}
        </Text>

        <Text style={styles.details}>
          Saved rides: {savedRideCount}
        </Text>

        {!rideActive ? (
            <Pressable style={styles.startButton} onPress={startRide}>
              <Text style={styles.buttonText}>Start Ride</Text>
            </Pressable>
        ) : (
            <Pressable style={styles.stopButton} onPress={stopRide}>
              <Text style={styles.buttonText}>
                {saving ? "Saving..." : "Stop Ride"}
              </Text>
            </Pressable>
        )}

        <View style={styles.interactions}>
          {observationProfile?.types.filter((type) => type.is_active).map((type) => (
            <InteractionButton
              key={type.id}
              label={`${type.icon} ${type.label}`}
              onPress={() => recordObservation(type)}
            />
          ))}
        </View>
      </SafeAreaView>
  );
}

type InteractionButtonProps = {
  label: string;
  onPress: () => void;
};

function InteractionButton({
                             label,
                             onPress,
                           }: InteractionButtonProps) {
  return (
      <Pressable style={styles.interactionButton} onPress={onPress}>
        <Text style={styles.interactionText}>{label}</Text>
      </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  title: {
    fontSize: 34,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 12,
  },
  status: {
    fontSize: 18,
    textAlign: "center",
    marginBottom: 8,
  },
  details: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 8,
  },
  startButton: {
    backgroundColor: "#15803d",
    padding: 18,
    borderRadius: 12,
    marginTop: 18,
    marginBottom: 24,
  },
  stopButton: {
    backgroundColor: "#b91c1c",
    padding: 18,
    borderRadius: 12,
    marginTop: 18,
    marginBottom: 24,
  },
  buttonText: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
  },
  interactions: {
    gap: 12,
  },
  interactionButton: {
    backgroundColor: "#e5e7eb",
    padding: 28,
    borderRadius: 12,
  },
  interactionText: {
    fontSize: 24,
    textAlign: "center",
  },
});
