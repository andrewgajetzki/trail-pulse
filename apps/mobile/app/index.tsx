import { useState } from "react";
import { router } from "expo-router";
import {
  isErrorWithCode,
  statusCodes,
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
      <View style={styles.content}>
        <Text style={styles.title}>Trail Pulse</Text>
        <Text style={styles.subtitle}>Track your rides and trail interactions.</Text>

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
            <ActivityIndicator color="#17202a" />
          ) : (
            <Text style={styles.buttonText}>Continue with Google</Text>
          )}
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </View>
  );
}

function getSignInErrorMessage(error: unknown) {
  if (isErrorWithCode(error)) {
    if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return "Google Play services is unavailable or needs an update.";
    }

    if (error.code === statusCodes.IN_PROGRESS) {
      return "Google sign-in is already in progress.";
    }
  }

  return "Google sign-in could not be completed. Check the app and Google Cloud configuration, then try again.";
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f4f6f5",
  },
  content: {
    gap: 16,
  },
  title: {
    color: "#17202a",
    fontSize: 38,
    fontWeight: "800",
  },
  subtitle: {
    color: "#5d6d65",
    fontSize: 18,
    lineHeight: 26,
    marginBottom: 16,
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    borderWidth: 1,
    borderColor: "#d7dfda",
    borderRadius: 12,
    backgroundColor: "white",
  },
  buttonPressed: {
    opacity: 0.65,
  },
  buttonText: {
    color: "#17202a",
    fontSize: 17,
    fontWeight: "700",
  },
  error: {
    color: "#b42318",
    lineHeight: 20,
  },
});
