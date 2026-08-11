import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { getTrips, TripSummary } from "../../lib/api";

export default function HistoryScreen() {
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTrips = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      setTrips(await getTrips());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Ride history could not be loaded.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadTrips();
    }, [loadTrips]),
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.message}>Loading rides...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={trips}
        keyExtractor={(trip) => String(trip.id)}
        refreshing={refreshing}
        onRefresh={() => void loadTrips(true)}
        contentContainerStyle={trips.length === 0 ? styles.emptyList : styles.list}
        ListHeaderComponent={<Text style={styles.title}>Ride History</Text>}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyTitle}>{error ? "Couldn’t load rides" : "No rides yet"}</Text>
            <Text style={styles.message}>
              {error ?? "Finish a ride and it will appear here."}
            </Text>
            {error ? (
              <Pressable style={styles.retryButton} onPress={() => void loadTrips()}>
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            ) : null}
          </View>
        }
        renderItem={({ item }) => <RideCard trip={item} />}
      />
    </SafeAreaView>
  );
}

function RideCard({ trip }: { trip: TripSummary }) {
  const durationMinutes = Math.max(1, Math.round((trip.ended_at - trip.started_at) / 60000));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View ride from ${new Date(trip.started_at).toLocaleString()}`}
      onPress={() => router.push(`/trips/${trip.id}`)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.cardContent}>
        <View>
          <Text style={styles.date}>{new Date(trip.started_at).toLocaleString()}</Text>
          <Text style={styles.meta}>{durationMinutes} min · {trip.location_point_count} GPS points</Text>
          <Text style={styles.meta}>{trip.interaction_count} interactions</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  list: {
    padding: 24,
    gap: 12,
  },
  emptyList: {
    flexGrow: 1,
    padding: 24,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
  },
  card: {
    padding: 18,
    borderRadius: 12,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardPressed: {
    opacity: 0.65,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chevron: {
    color: "#64748b",
    fontSize: 32,
    marginLeft: 12,
  },
  date: {
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 8,
  },
  meta: {
    color: "#475569",
    lineHeight: 22,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 8,
  },
  message: {
    color: "#64748b",
    textAlign: "center",
    marginTop: 10,
  },
  retryButton: {
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#15803d",
  },
  retryText: {
    color: "white",
    fontWeight: "600",
  },
});
