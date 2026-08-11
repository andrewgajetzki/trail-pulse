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
```

Then install and run Expo:

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go. After installing a native dependency, restart Metro with:

```bash
npx expo start --clear
```

## Routes

- `app/(tabs)/index.tsx` — active ride recording
- `app/(tabs)/history.tsx` — saved rides, newest first
- `app/trips/[id].tsx` — ride details and route map

## API Configuration

The mobile app communicates only with the backend's `/api` routes through Caddy. Do not use `localhost` for `EXPO_PUBLIC_API_URL` when testing on a physical phone.

Authentication UI has not been added to the mobile app yet. Ride creation will resume once Google sign-in supplies the authenticated user ID to the backend.
