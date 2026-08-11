# Trail Pulse Mobile

The Trail Pulse mobile app is an Expo and React Native client for recording bike rides and trail interactions.

## Features

- GPS ride recording with Expo Location
- Quick `Greeted me` and `No response` interaction logging
- Ride history, details, metrics, and route maps
- Native maps with route, start, finish, and interaction markers

## Setup

Start the backend from the repository root first. It must be reachable by the phone on the same local network.

Create `apps/mobile/.env.local`:

```env
EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_LAN_IP/api
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-oauth-client-id.apps.googleusercontent.com
```

Then install and run Expo:

```bash
npm install
npx expo start
```

Google Sign-In uses a native module and does **not** work in Expo Go. Build and install a development build or a standalone Android app instead:

```bash
npx expo prebuild --clean
npx expo run:android
```

For a distributable Android build, configure EAS and run `eas build --platform android`.

## Routes

- `app/(tabs)/index.tsx` — active ride recording
- `app/(tabs)/history.tsx` — saved rides, newest first
- `app/trips/[id].tsx` — ride details and route map

## API Configuration

The mobile app communicates only with the backend's `/api` routes through Caddy. Do not use `localhost` for `EXPO_PUBLIC_API_URL` when testing on a physical phone.

## Google Sign-In setup

The permanent Android package name is:

```text
com.andrewgajetzki.trailpulse
```

In Google Cloud Console:

1. Create or select the Google Cloud project that owns Trail Pulse.
2. Open **Google Auth platform** → **Branding**, configure the OAuth consent screen, and provide the app name, user support email, and developer contact email. Choose the appropriate audience; for an External app in testing, add each tester under **Audience** → **Test users**.
3. Open **Google Auth platform** → **Clients** → **Create client** → **Android**. Enter package name `com.andrewgajetzki.trailpulse` and the SHA-1 fingerprint for the signing certificate used by that build.
4. Create an Android client for every signing certificate you use with that package name. Register the debug certificate for local development, the EAS/release certificate for direct APK/AAB builds, and the Google Play App Signing certificate for Play-distributed builds.
5. Create a **Web application** OAuth client. Its client ID is required to request the Google ID token whose audience the Trail Pulse API verifies. No client secret belongs in this app, and this native ID-token exchange does not need a web redirect URI.
6. Set the Web client ID in both places: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in `apps/mobile/.env.local`, and `GOOGLE_CLIENT_ID` in the backend root `.env`.

To print the standard local Android debug SHA-1:

```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

For an EAS or Play release, use the SHA-1 reported by that service’s signing certificate rather than the debug fingerprint.

The app sends only the Google ID token to `POST /api/auth/google`. The backend verifies it, then returns a Trail Pulse JWT and profile. The app does not persist that JWT yet, so the session ends when the app reloads or closes.
