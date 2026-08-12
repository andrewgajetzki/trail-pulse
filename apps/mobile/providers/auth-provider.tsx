import { createContext, ReactNode, useContext, useMemo, useState } from "react";
import {
  GoogleSignin,
  isSuccessResponse,
} from "@react-native-google-signin/google-signin";

import { AuthSession, signInWithGoogle } from "../lib/api";

const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

type GoogleSignInResult =
  | { status: "success" }
  | { status: "cancelled" };

type AuthContextValue = {
  session: AuthSession | null;
  signInWithGoogleAccount: () => Promise<GoogleSignInResult>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      async signInWithGoogleAccount() {
        if (!googleWebClientId) {
          throw new Error("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not configured");
        }

        GoogleSignin.configure({
          webClientId: googleWebClientId,
          offlineAccess: false,
        });

        await GoogleSignin.hasPlayServices({
          showPlayServicesUpdateDialog: true,
        });

        try {
          const response = await GoogleSignin.signIn();

          if (!isSuccessResponse(response)) {
            return { status: "cancelled" };
          }

          const idToken = response.data.idToken;

          if (!idToken) {
            throw new Error("Google did not return an ID token");
          }

          setSession(await signInWithGoogle(idToken));
          return { status: "success" };
        } catch (error: any) {
          Alert.alert(
              "Google Sign-In Error",
              `Code: ${error?.code ?? "unknown"}\nMessage: ${error?.message ?? String(error)}`
          );

          console.error("GOOGLE SIGN-IN ERROR:", error);
          throw error;
        }

        if (!isSuccessResponse(response)) {
          return { status: "cancelled" };
        }

        const idToken = response.data.idToken;

        if (!idToken) {
          throw new Error("Google did not return an ID token");
        }

        setSession(await signInWithGoogle(idToken));
        return { status: "success" };
      },
    }),
    [session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
