import { useState } from "react";
import { router } from "expo-router";
import {
  isErrorWithCode,
} from "@react-native-google-signin/google-signin";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "../providers/auth-provider";

export default function LoginScreen() {
  const { signInWithGoogleAccount } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    if (signingIn) {
      return;
    }

    setSigningIn(true);
    setError(null);

    try {
      const result = await signInWithGoogleAccount();

      if (result.status === "success") {
        router.replace("/(tabs)");
      }
    } catch (signInError) {
      setError(getSignInErrorMessage(signInError));
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.sun} />
        <View style={styles.ridgeFar} />
        <View style={styles.ridgeNear} />
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>TRAIL PULSE</Text>
          <Text style={styles.title}>More than{`\n`}just a ride.</Text>
          <Text style={styles.heroSubtitle}>Notice what happens out on the trail.</Text>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.welcome}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to record your rides and observations.</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
          disabled={signingIn}
          onPress={() => void handleGoogleSignIn()}
          style={({ pressed }) => [
            styles.button,
            (pressed || signingIn) && styles.buttonPressed,
          ]}
        >
          {signingIn ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Continue with Google</Text>
          )}
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Text style={styles.footnote}>Your rides stay connected to your account.</Text>
      </View>
    </View>
  );
}

function getSignInErrorMessage(error: unknown) {
  if (isErrorWithCode(error)) {
    return `Google error: ${error.code} - ${error.message}`;
  }

  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }

  return `Unknown error: ${String(error)}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4f6f5",
  },
  hero: { backgroundColor: "#165c49", borderBottomLeftRadius: 36, borderBottomRightRadius: 36, height: "54%", minHeight: 390, overflow: "hidden" },
  sun: { backgroundColor: "#f8cb77", borderRadius: 90, height: 180, opacity: 0.95, position: "absolute", right: -28, top: 38, width: 180 },
  ridgeFar: { backgroundColor: "#2b8068", borderRadius: 180, bottom: -115, height: 270, left: -70, position: "absolute", transform: [{ rotate: "-8deg" }], width: "130%" },
  ridgeNear: { backgroundColor: "#104d3d", borderRadius: 180, bottom: -160, height: 300, right: -100, position: "absolute", transform: [{ rotate: "9deg" }], width: "135%" },
  heroCopy: { bottom: 45, left: 28, position: "absolute", right: 26 },
  eyebrow: { color: "#b9eadb", fontSize: 12, fontWeight: "800", letterSpacing: 2 },
  content: {
    backgroundColor: "#f4f6f5",
    flex: 1,
    padding: 28,
    paddingTop: 30,
  },
  title: {
    color: "#ffffff",
    fontSize: 42,
    fontWeight: "800",
    letterSpacing: -1.2,
    lineHeight: 46,
    marginTop: 12,
  },
  heroSubtitle: {
    color: "#d8f0e8",
    fontSize: 17,
    lineHeight: 24,
    marginTop: 12,
    maxWidth: 270,
  },
  welcome: {
    color: "#17202a",
    fontSize: 26,
    fontWeight: "800",
  },
  subtitle: {
    color: "#5d6d65",
    fontSize: 16,
    lineHeight: 23,
    marginBottom: 24,
    marginTop: 7,
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
    borderRadius: 15,
    backgroundColor: "#167a63",
    shadowColor: "#0b3d30",
    shadowOpacity: 0.2,
    shadowRadius: 9,
    elevation: 3,
  },
  buttonPressed: {
    opacity: 0.65,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
  },
  error: {
    color: "#b42318",
    lineHeight: 20,
  },
  footnote: { color: "#7a8982", fontSize: 13, marginTop: 18, textAlign: "center" },
});
