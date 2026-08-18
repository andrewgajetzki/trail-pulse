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
  ObservationProfile,
  ObservationType,
  getTrips,
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
  const [profiles, setProfiles] = useState<ObservationProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [activeProfile, setActiveProfile] = useState<ObservationProfileDetail | null>(null);

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

    Promise.all([getObservationProfiles(session.access_token), getTrips(session.access_token)])
      .then(([allProfiles, trips]) => {
        const activeProfiles = allProfiles.filter((profile) => profile.is_active);
        setProfiles(activeProfiles);
        const recentProfileId = trips[0]?.observation_profile_id;
        setSelectedProfileId(activeProfiles.some((profile) => profile.id === recentProfileId) ? recentProfileId : activeProfiles[0]?.id ?? null);
      })
      .catch((error) => console.error("Could not load observation profile:", error));
  }, [session]);

  async function startRide() {
    if (!session || !selectedProfileId) {
      Alert.alert("Choose a profile", "Select an observation profile before starting your ride.");
      return;
    }

    let profile: ObservationProfileDetail;
    try {
      profile = await getObservationProfile(selectedProfileId, session.access_token);
    } catch {
      Alert.alert("Observation profile unavailable", "Please try selecting a profile again.");
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
    setActiveProfile(profile);
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

    if (!session || !activeProfile) {
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
        observationProfileId: activeProfile.id,
        observations,
        accessToken: session.access_token,
      });

      setRideActive(false);
      setRideStartedAt(null);
      setActiveProfile(null);

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
            <View style={styles.profilePicker}>
              <Text style={styles.pickerTitle}>What are you observing?</Text>
              {profiles.map((profile) => (
                <Pressable key={profile.id} style={styles.profileOption} onPress={() => setSelectedProfileId(profile.id)}>
                  <Text style={styles.radio}>{selectedProfileId === profile.id ? "●" : "○"}</Text>
                  <Text style={styles.profileOptionLabel}>{profile.name}</Text>
                </Pressable>
              ))}
              <Pressable style={styles.startButton} onPress={() => void startRide()}>
                <Text style={styles.buttonText}>Start Ride</Text>
              </Pressable>
            </View>
        ) : (
            <Pressable style={styles.stopButton} onPress={stopRide}>
              <Text style={styles.buttonText}>
                {saving ? "Saving..." : "Stop Ride"}
              </Text>
            </Pressable>
        )}

        <View style={styles.interactions}>
          {activeProfile?.types.filter((type) => type.is_active).map((type) => (
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
  profilePicker: { marginTop: 18 },
  pickerTitle: { color: "#17202a", fontSize: 21, fontWeight: "800", marginBottom: 12 },
  profileOption: { alignItems: "center", flexDirection: "row", paddingVertical: 10 },
  radio: { color: "#167a63", fontSize: 25, marginRight: 10 },
  profileOptionLabel: { color: "#17202a", fontSize: 17 },
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
