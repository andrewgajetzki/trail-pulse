import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
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
  const [profileSelectorOpen, setProfileSelectorOpen] = useState(true);
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
    if (!session) {
      setProfiles([]);
      setSelectedProfileId(null);
      return;
    }

    let cancelled = false;

    Promise.all([getObservationProfiles(session.access_token), getTrips(session.access_token)])
      .then(([allProfiles, trips]) => {
        if (cancelled) return;
        const activeProfiles = allProfiles.filter((profile) => profile.is_active);
        setProfiles(activeProfiles);
        const recentProfileId = trips[0]?.observation_profile_id;
        setSelectedProfileId(activeProfiles.some((profile) => profile.id === recentProfileId) ? recentProfileId : activeProfiles[0]?.id ?? null);
      })
      .catch((error) => {
        if (!cancelled) console.error("Could not load observation profile:", error);
      });

    return () => { cancelled = true; };
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
      setLocationPoints([]);
      setObservations([]);
      setCurrentLocation(null);
      setSavedRideCount((count) => count + 1);

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
      <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
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
              <Pressable style={styles.profileSelector} onPress={() => setProfileSelectorOpen((open) => !open)}>
                <Text style={styles.profileSelectorText}>{profiles.find((profile) => profile.id === selectedProfileId)?.name ?? "Select profile"}</Text>
                <Text style={styles.selectorChevron}>{profileSelectorOpen ? "⌃" : "⌄"}</Text>
              </Pressable>
              {profileSelectorOpen ? profiles.map((profile) => (
                <Pressable key={profile.id} style={styles.profileOption} onPress={() => { setSelectedProfileId(profile.id); setProfileSelectorOpen(false); }}>
                  <Text style={styles.radio}>{selectedProfileId === profile.id ? "●" : "○"}</Text>
                  <Text style={styles.profileOptionLabel}>{profile.name}</Text>
                </Pressable>
              )) : null}
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
              icon={type.icon}
              label={type.label}
              onPress={() => recordObservation(type)}
            />
          ))}
        </View>
      </ScrollView>
      </SafeAreaView>
  );
}

type InteractionButtonProps = {
  icon: string;
  label: string;
  onPress: () => void;
};

function InteractionButton({
                             icon,
                             label,
                             onPress,
                           }: InteractionButtonProps) {
  return (
      <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Record ${label}`}
          style={({ pressed }) => [styles.interactionButton, pressed && styles.interactionButtonPressed]}
          onPress={onPress}
      >
        <Text style={styles.interactionIcon}>{icon}</Text>
        <Text numberOfLines={2} style={styles.interactionText}>{label}</Text>
      </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: {
    flexGrow: 1,
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
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  profilePicker: { marginTop: 18 },
  pickerTitle: { color: "#17202a", fontSize: 21, fontWeight: "800", marginBottom: 12 },
  profileSelector: { alignItems: "center", backgroundColor: "white", borderColor: "#c9dfd4", borderRadius: 12, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 14 },
  profileSelectorText: { color: "#17202a", fontSize: 17, fontWeight: "700" }, selectorChevron: { color: "#167a63", fontSize: 24 },
  profileOption: { alignItems: "center", flexDirection: "row", paddingVertical: 10 },
  radio: { color: "#167a63", fontSize: 25, marginRight: 10 },
  profileOptionLabel: { color: "#17202a", fontSize: 17 },
  interactionButton: {
    alignItems: "center",
    backgroundColor: "#e5f2ed",
    borderColor: "#c9dfd4",
    borderRadius: 16,
    borderWidth: 1,
    flexGrow: 1,
    flexBasis: "46%",
    justifyContent: "center",
    minHeight: 112,
    padding: 12,
  },
  interactionButtonPressed: {
    backgroundColor: "#cfe8dc",
    transform: [{ scale: 0.97 }],
  },
  interactionIcon: {
    fontSize: 42,
    marginBottom: 6,
  },
  interactionText: {
    color: "#173f31",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
});
