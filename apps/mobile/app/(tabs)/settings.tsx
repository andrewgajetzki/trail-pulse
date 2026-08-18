import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Image, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";

import { createObservationProfile, getObservationProfiles, ObservationProfile } from "../../lib/api";
import { useAuth } from "../../providers/auth-provider";

export default function SettingsScreen() {
  const { session, signOut } = useAuth();
  const [profiles, setProfiles] = useState<ObservationProfile[]>([]);
  const [newProfileName, setNewProfileName] = useState("");
  const [addingProfile, setAddingProfile] = useState(false);
  const accessToken = session?.access_token;

  const loadProfiles = useCallback(async () => {
    if (!accessToken) return;
    setProfiles(await getObservationProfiles(accessToken));
  }, [accessToken]);

  useFocusEffect(useCallback(() => { void loadProfiles().catch((error) => console.error("Could not load profiles:", error)); }, [loadProfiles]));

  if (!session) return null;

  const { user } = session;
  const initials = user.name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  async function addProfile() {
    if (!newProfileName.trim() || addingProfile || !accessToken) return;
    setAddingProfile(true);
    try {
      const profile = await createObservationProfile(newProfileName, accessToken);
      setNewProfileName("");
      setProfiles((current) => [...current, profile]);
      router.push(`/observation-profiles/${profile.id}`);
    } catch (error) {
      Alert.alert("Could not create profile", error instanceof Error ? error.message : "Please try again.");
    } finally { setAddingProfile(false); }
  }

  function confirmSignOut() {
    Alert.alert("Log out?", "You’ll need to sign in again to save or view rides.", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: () => void signOut().then(() => router.replace("/")) },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>TRAIL PULSE</Text>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Your account and ride preferences.</Text>

        <View style={styles.profileCard}>
          {user.picture_url ? <Image source={{ uri: user.picture_url }} style={styles.avatar} /> : <View style={[styles.avatar, styles.initials]}><Text style={styles.initialsText}>{initials || "TP"}</Text></View>}
          <View style={styles.profileCopy}>
            <Text style={styles.name}>{user.name}</Text>
            <Text style={styles.email}>{user.email ?? "Google account"}</Text>
          </View>
          <View style={styles.connectedBadge}><View style={styles.connectedDot} /><Text style={styles.connectedText}>Connected</Text></View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          <View style={styles.row}><Text style={styles.rowLabel}>Signed in with</Text><Text style={styles.rowValue}>Google</Text></View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>OBSERVATION PROFILES</Text>
          {profiles.map((profile) => (
            <Pressable key={profile.id} style={styles.profileRow} onPress={() => router.push(`/observation-profiles/${profile.id}`)}>
              <View><Text style={styles.rowLabel}>{profile.name}</Text>{!profile.is_active ? <Text style={styles.archived}>Archived</Text> : null}</View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
          <View style={styles.addProfile}>
            <TextInput value={newProfileName} onChangeText={setNewProfileName} placeholder="New profile name" style={styles.input} />
            <Pressable onPress={() => void addProfile()} style={styles.addButton}><Text style={styles.addButtonText}>{addingProfile ? "Adding…" : "+ Add Profile"}</Text></Pressable>
          </View>
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel="Log out" onPress={confirmSignOut} style={({ pressed }) => [styles.logOutButton, pressed && styles.buttonPressed]}>
          <Text style={styles.logOutText}>Log out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f6f5" }, content: { flex: 1, padding: 24 },
  eyebrow: { color: "#167a63", fontSize: 12, fontWeight: "800", letterSpacing: 1.5, marginTop: 12 }, title: { color: "#17202a", fontSize: 36, fontWeight: "800", marginTop: 6 }, subtitle: { color: "#5d6d65", fontSize: 16, lineHeight: 23, marginTop: 4 },
  profileCard: { alignItems: "center", backgroundColor: "#ffffff", borderColor: "#dce5df", borderRadius: 20, borderWidth: 1, flexDirection: "row", marginTop: 30, padding: 18 }, avatar: { backgroundColor: "#d7f2e9", borderRadius: 30, height: 60, width: 60 }, initials: { alignItems: "center", justifyContent: "center" }, initialsText: { color: "#126750", fontSize: 20, fontWeight: "800" },
  profileCopy: { flex: 1, marginLeft: 14 }, name: { color: "#17202a", fontSize: 17, fontWeight: "800" }, email: { color: "#64746c", fontSize: 13, marginTop: 4 }, connectedBadge: { alignItems: "center", flexDirection: "row", position: "absolute", right: 16, top: 14 }, connectedDot: { backgroundColor: "#22a06b", borderRadius: 4, height: 8, marginRight: 5, width: 8 }, connectedText: { color: "#397154", fontSize: 11, fontWeight: "700" },
  section: { backgroundColor: "#ffffff", borderColor: "#dce5df", borderRadius: 16, borderWidth: 1, marginTop: 28, overflow: "hidden" }, sectionTitle: { color: "#789087", fontSize: 11, fontWeight: "800", letterSpacing: 1.2, paddingHorizontal: 16, paddingTop: 15 }, row: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 16 }, rowLabel: { color: "#52635a", fontSize: 16 }, rowValue: { color: "#17202a", fontSize: 16, fontWeight: "700" },
  profileRow: { alignItems: "center", borderTopColor: "#eef2ef", borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 15 }, archived: { color: "#8a9690", fontSize: 12, marginTop: 3 }, chevron: { color: "#7b8b83", fontSize: 28 }, addProfile: { borderTopColor: "#eef2ef", borderTopWidth: 1, padding: 14 }, input: { backgroundColor: "#f6f8f7", borderColor: "#dce5df", borderRadius: 10, borderWidth: 1, fontSize: 16, paddingHorizontal: 12, paddingVertical: 10 }, addButton: { alignItems: "center", backgroundColor: "#d7f2e9", borderRadius: 10, marginTop: 10, padding: 12 }, addButtonText: { color: "#126750", fontWeight: "800" },
  logOutButton: { alignItems: "center", borderColor: "#e9b7b1", borderRadius: 14, borderWidth: 1, justifyContent: "center", marginTop: "auto", minHeight: 54 }, logOutText: { color: "#b42318", fontSize: 16, fontWeight: "800" }, buttonPressed: { opacity: 0.65 },
});
