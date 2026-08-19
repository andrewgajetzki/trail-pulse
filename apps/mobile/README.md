# Trail Pulse Mobile

The mobile client is an Expo / React Native app for Google-authenticated ride recording, configurable observation profiles, ride history, and route maps.

## Local setup

Mobile and server settings are intentionally kept in the repository-root `.env`. From the repository root, create it once:

```bash
cp .env.example .env
```

Set the three mobile variables there:

```env
EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_LAN_IP/api
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-oauth-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your-android-maps-api-key
```

`EXPO_PUBLIC_` values are bundled into the app, so they are not secrets. Never add a mobile `.env.local`; all npm scripts load `../../.env` with Node's `--env-file` option.

Start the backend from the repository root, including migrations:

```bash
docker compose up --build -d
docker compose run --rm --no-deps api alembic upgrade head
```

Then, from this directory:

```bash
npm install
npm run start
```

Use the development computer's LAN IP in `EXPO_PUBLIC_API_URL` for a physical device. `localhost` points to the phone/emulator, not the computer running the API.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run start` | Start Expo / Metro with root environment values |
| `npm run start -- --clear` | Start Metro after clearing its cache |
| `npm run lint` | Run Expo linting |
| `npm run android` | Build and install a local Android development build |
| `npm run ios` | Build and install a local iOS build (macOS required) |
| `npm run web` | Start the web target |
| `npm run prebuild -- --clean` | Regenerate native projects after native-config changes |

Google Sign-In and Android Maps use native modules/configuration. They are not supported by Expo Go; use `npm run android`, an EAS development build, or a release build. Rebuild after changing the Maps API key.

## Google and Maps setup

The Android package name is `com.andrewgajetzki.trailpulse`.

In Google Cloud:

1. Configure the OAuth consent screen and add test users as needed.
2. Create a Web OAuth client. Its client ID must be set as both `GOOGLE_CLIENT_ID` (API) and `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (mobile).
3. Create Android OAuth clients for the package name and the SHA-1 fingerprints for each signing certificate: local debug, EAS/release, and Google Play App Signing when applicable.
4. Enable Maps SDK for Android. Create an Android-restricted Maps key for the same package and SHA-1 fingerprints, then set `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`.

The app exchanges the Google ID token with the API. The API verifies the token and returns a Trail Pulse session; the session currently lasts only for the running app process.

## EAS builds and distribution

EAS cloud builders do not receive the ignored local root `.env`. Define the following EAS environment variables for every profile/environment that needs them:

```text
EXPO_PUBLIC_API_URL
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
```

Install/use EAS from this directory and build Android artifacts:

```bash
npx eas-cli login
npx eas-cli build --platform android --profile development
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform android --profile production
```

The configured profiles are:

- `development`: development client with internal distribution.
- `preview`: internally distributed installable build.
- `production`: store-oriented build with remote version auto-increment.

Once the production build is ready and Play credentials are configured, submit it with:

```bash
npx eas-cli submit --platform android --profile production
```

Before making an EAS or Play build, register the relevant signing SHA-1 in both the Android OAuth client and the Android Maps key restrictions. Ensure the production API URL is HTTPS and publicly reachable.

## App layout

- `app/(tabs)/index.tsx`: ride recording and observation entry.
- `app/(tabs)/history.tsx`: authenticated ride history.
- `app/trips/[id].tsx`: ride metrics and map.
- `app/observation-profiles/[id].tsx`: profile and observation-type editing.
- `providers/auth-provider.tsx`: Google sign-in session state.
- `lib/api.ts`: API client and request types.

See the [repository README](../../README.md) for server deployment, API endpoints, migrations, and the full environment reference.
