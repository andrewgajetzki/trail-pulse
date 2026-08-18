import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import {
  createObservationType,
  getObservationProfile,
  ObservationProfileDetail,
  ObservationType,
  updateObservationProfile,
  updateObservationType,
} from "../../lib/api";
import { useAuth } from "../../providers/auth-provider";

export default function ObservationProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [profile, setProfile] = useState<ObservationProfileDetail | null>(null);
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState("✨");

  const profileId = Number(id);
  const load = useCallback(async () => {
    if (!session || !Number.isInteger(profileId)) return;
    const next = await getObservationProfile(profileId, session.access_token);
    setProfile(next);
    setName(next.name);
  }, [profileId, session]);

  useEffect(() => { void load().catch((error) => Alert.alert("Could not load profile", String(error))); }, [load]);

  if (!profile || !session) return <View style={styles.center}><Text>Loading profile…</Text></View>;
  const currentProfile = profile;
  const accessToken = session.access_token;

  async function saveProfile(changes: { name?: string; is_active?: boolean }) {
    try { const next = await updateObservationProfile(currentProfile.id, changes, accessToken); setProfile(next); setName(next.name); }
    catch (error) { Alert.alert("Could not update profile", error instanceof Error ? error.message : "Please try again."); }
  }

  async function addType() {
    if (!label.trim()) return;
    try {
      await createObservationType(currentProfile.id, { label, icon: icon.trim() || "✨", sort_order: (currentProfile.types.at(-1)?.sort_order ?? 0) + 1 }, accessToken);
      setLabel(""); setIcon("✨"); await load();
    } catch (error) { Alert.alert("Could not add observation type", error instanceof Error ? error.message : "Please try again."); }
  }

  async function updateType(type: ObservationType, changes: Partial<Pick<ObservationType, "label" | "icon" | "sort_order" | "is_active">>) {
    try { await updateObservationType(type.id, changes, accessToken); await load(); }
    catch (error) { Alert.alert("Could not update observation type", error instanceof Error ? error.message : "Please try again."); }
  }

  async function moveType(index: number, direction: -1 | 1) {
    const other = currentProfile.types[index + direction]; const current = currentProfile.types[index];
    if (!other) return;
    try {
      await Promise.all([
        updateObservationType(current.id, { sort_order: other.sort_order }, accessToken),
        updateObservationType(other.id, { sort_order: current.sort_order }, accessToken),
      ]);
      await load();
    } catch (error) { Alert.alert("Could not reorder types", error instanceof Error ? error.message : "Please try again."); }
  }

  return <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.eyebrow}>OBSERVATION PROFILE</Text>
    <TextInput value={name} onChangeText={setName} style={styles.nameInput} onBlur={() => name.trim() && name !== currentProfile.name && void saveProfile({ name })} />
    <Text style={styles.help}>Changes save when you leave the profile name or type fields.</Text>

    <View style={styles.section}>
      <Text style={styles.sectionTitle}>OBSERVATION TYPES</Text>
      {currentProfile.types.map((type, index) => <TypeRow key={type.id} type={type} canMoveUp={index > 0} canMoveDown={index < currentProfile.types.length - 1} onSave={updateType} onMove={(direction) => void moveType(index, direction)} />)}
      <View style={styles.addBox}>
        <TextInput value={icon} onChangeText={setIcon} style={styles.iconInput} maxLength={8} />
        <TextInput value={label} onChangeText={setLabel} placeholder="Observation type label" style={styles.labelInput} />
        <Pressable style={styles.addButton} onPress={() => void addType()}><Text style={styles.addButtonText}>+ Add Observation Type</Text></Pressable>
      </View>
    </View>

    <Pressable style={styles.archiveButton} onPress={() => void saveProfile({ is_active: !currentProfile.is_active })}><Text style={styles.archiveText}>{currentProfile.is_active ? "Archive Profile" : "Restore Profile"}</Text></Pressable>
  </ScrollView>;
}

function TypeRow({ type, canMoveUp, canMoveDown, onSave, onMove }: { type: ObservationType; canMoveUp: boolean; canMoveDown: boolean; onSave: (type: ObservationType, changes: Partial<Pick<ObservationType, "label" | "icon" | "is_active">>) => Promise<void>; onMove: (direction: -1 | 1) => void }) {
  const [label, setLabel] = useState(type.label); const [icon, setIcon] = useState(type.icon);
  return <View style={[styles.typeRow, !type.is_active && styles.archivedRow]}>
    <TextInput value={icon} onChangeText={setIcon} onBlur={() => icon.trim() && icon !== type.icon && void onSave(type, { icon })} style={styles.typeIcon} maxLength={8} />
    <TextInput value={label} onChangeText={setLabel} onBlur={() => label.trim() && label !== type.label && void onSave(type, { label })} style={styles.typeLabel} />
    <View><Pressable disabled={!canMoveUp} onPress={() => onMove(-1)}><Text style={styles.move}>↑</Text></Pressable><Pressable disabled={!canMoveDown} onPress={() => onMove(1)}><Text style={styles.move}>↓</Text></Pressable></View>
    <Pressable onPress={() => void onSave(type, { is_active: !type.is_active })}><Text style={styles.archiveSmall}>{type.is_active ? "Archive" : "Restore"}</Text></Pressable>
  </View>;
}

const styles = StyleSheet.create({
  container: { backgroundColor: "#f4f6f5", flexGrow: 1, padding: 24 }, center: { alignItems: "center", flex: 1, justifyContent: "center" }, eyebrow: { color: "#167a63", fontSize: 12, fontWeight: "800", letterSpacing: 1.4, marginTop: 12 }, nameInput: { color: "#17202a", fontSize: 31, fontWeight: "800", marginTop: 6, padding: 0 }, help: { color: "#64746c", marginTop: 8 }, section: { backgroundColor: "white", borderColor: "#dce5df", borderRadius: 18, borderWidth: 1, marginTop: 28, overflow: "hidden" }, sectionTitle: { color: "#789087", fontSize: 11, fontWeight: "800", letterSpacing: 1.2, padding: 16 }, typeRow: { alignItems: "center", borderTopColor: "#edf1ee", borderTopWidth: 1, flexDirection: "row", gap: 8, padding: 12 }, archivedRow: { opacity: 0.55 }, typeIcon: { fontSize: 22, textAlign: "center", width: 40 }, typeLabel: { color: "#17202a", flex: 1, fontSize: 16, padding: 4 }, move: { color: "#167a63", fontSize: 19, fontWeight: "800", lineHeight: 19, paddingHorizontal: 4 }, archiveSmall: { color: "#a2493e", fontSize: 11, fontWeight: "700", marginLeft: 4 }, addBox: { borderTopColor: "#edf1ee", borderTopWidth: 1, flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 12 }, iconInput: { backgroundColor: "#f5f8f6", borderColor: "#dce5df", borderRadius: 10, borderWidth: 1, fontSize: 20, padding: 8, textAlign: "center", width: 52 }, labelInput: { backgroundColor: "#f5f8f6", borderColor: "#dce5df", borderRadius: 10, borderWidth: 1, flex: 1, fontSize: 16, paddingHorizontal: 10 }, addButton: { alignItems: "center", backgroundColor: "#d7f2e9", borderRadius: 10, padding: 12, width: "100%" }, addButtonText: { color: "#126750", fontWeight: "800" }, archiveButton: { alignItems: "center", borderColor: "#e9b7b1", borderRadius: 14, borderWidth: 1, marginTop: 28, padding: 16 }, archiveText: { color: "#b42318", fontWeight: "800" },
});
