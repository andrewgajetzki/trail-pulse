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

import { saveTrip } from "../../lib/api";

import {
  getSavedRideCount,
  initializeDatabase,
} from "../../lib/database";

type InteractionType = "Greeted me" | "No response";

type Interaction = {
  type: InteractionType;
  latitude: number;
  longitude: number;
  timestamp: number;
};

export default function HomeScreen() {
  const [rideActive, setRideActive] = useState(false);
  const [locationPoints, setLocationPoints] = useState<
      Location.LocationObject[]
  >([]);
  const [currentLocation, setCurrentLocation] =
      useState<Location.LocationObject | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);

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
  async function startRide() {
    const permission =
        await Location.requestForegroundPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Location permission is required");
      return;
    }

    setLocationPoints([]);
    setInteractions([]);
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

    locationSubscription.current?.remove();
    locationSubscription.current = null;

    setSaving(true);

    try {
      const savedTrip = await saveTrip({
        startedAt: rideStartedAt,
        endedAt: Date.now(),
        locationPoints,
        interactions,
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

  function recordInteraction(type: InteractionType) {
    if (!rideActive) {
      Alert.alert("Start a ride first");
      return;
    }

    if (!currentLocation) {
      Alert.alert("Waiting for GPS location");
      return;
    }

    setInteractions((current) => [
      ...current,
      {
        type,
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
          Interactions: {interactions.length}
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
          <InteractionButton
              label="🙂 Greeted me"
              onPress={() => recordInteraction("Greeted me")}
          />

          <InteractionButton
              label="😐 No response"
              onPress={() => recordInteraction("No response")}
          />
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
