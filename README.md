# Trail Pulse

Trail Pulse is a mobile trip-tracking app for recording social interactions on Calgary bike trails. During a ride, it records GPS points and lets the rider quickly log whether another trail user returned a greeting. Completed rides are stored through a FastAPI backend in PostgreSQL.

<img width="743" height="659" alt="Trail Pulse ride screen" src="https://github.com/user-attachments/assets/59f98107-ae0c-4960-97f7-1597bda88f78" />

## Features

- Start and stop a bike ride
- Record GPS coordinates throughout the ride
- Log `🙂 Greeted me` and `😐 No response` interactions with their time and location
- Upload completed rides to FastAPI and store them in PostgreSQL
- Browse ride history in reverse chronological order
- Open a detailed summary for each ride
- View duration, distance, speed, interaction, and greeting-rate metrics
- Display the route, start, finish, and interaction markers on a native map

## Architecture

```text
Expo mobile app
      │
      │ HTTP /api
      ▼
    Caddy
      │
      ▼
FastAPI ──────► PostgreSQL
```

The Expo app is the only user interface. Caddy exposes the API to devices on the local network and forwards `/api/*` requests directly to FastAPI.

## Technology

### Mobile

- React Native and Expo
- TypeScript
- Expo Router and Expo Location
- React Native Maps

### Backend

- Python and FastAPI
- SQLAlchemy and Psycopg
- PostgreSQL
- Caddy
- Docker Compose

## Project Structure

```text
trail-pulse/
├── apps/
│   ├── api/
│   │   └── app/
│   │       ├── database.py
│   │       ├── main.py
│   │       ├── models.py
│   │       └── schemas.py
│   └── mobile/
│       ├── app/
│       ├── components/
│       ├── hooks/
│       └── lib/
├── Caddyfile
├── docker-compose.yml
└── README.md
```

## Prerequisites

- Git
- Docker and Docker Compose
- Node.js and npm
- Expo Go on an Android or iOS device

The phone and development computer must be connected to the same local network.

## Getting Started

### 1. Configure the backend

Clone the repository and enter it:

```bash
git clone <repository-url>
cd trail-pulse
```

Copy the safe template, then replace its password and JWT secret locally:

```bash
cp .env.example .env
openssl rand -hex 32
```

Set the generated value as `JWT_SECRET` in `.env`. Never commit `.env`.

### 2. Start the backend

Build and start Caddy, FastAPI, and PostgreSQL:

```bash
docker compose up --build -d
```

Check the containers and API health:

```bash
docker compose ps
curl http://localhost/api/health
```

Interactive API documentation is available at `http://localhost/api/docs`.

### 3. Find the computer's local IP address

On Linux:

```bash
ip route get 1.1.1.1 | awk '{print $7; exit}'
```

For example, the command may return `192.168.1.123`.

### 4. Configure the mobile app

Create `apps/mobile/.env.local` and replace the example address with the computer's local IP:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.123/api
```

Environment files are ignored by Git and should not be committed.

### 5. Start Expo

```bash
cd apps/mobile
npm install
npx expo start
```

Scan the QR code with Expo Go. If a newly installed native dependency is not detected, restart Metro with `npx expo start --clear`.

## API

All public URLs use the `/api` prefix. Caddy removes that prefix when forwarding requests to FastAPI.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Check API and database health |
| `POST` | `/api/trips` | Save a completed ride |
| `GET` | `/api/trips` | List rides, most recent first |
| `GET` | `/api/trips/{trip_id}` | Get a ride with its GPS points and interactions |

### Save a ride

```json
{
  "started_at": 1784840400000,
  "ended_at": 1784841000000,
  "location_points": [
    {
      "recorded_at": 1784840400000,
      "latitude": 50.9851,
      "longitude": -114.1125,
      "accuracy": 5.2,
      "speed": 4.1,
      "heading": 90
    }
  ],
  "interactions": [
    {
      "recorded_at": 1784840405000,
      "latitude": 50.9852,
      "longitude": -114.1122,
      "type": "Greeted me"
    }
  ]
}
```

## Authentication

JWT infrastructure is available for the upcoming Google sign-in work. Tokens use the Trail Pulse user ID as their `sub` claim and include an expiration (`exp`). The API reads these values from the root `.env` file:

```env
JWT_SECRET=replace-with-a-long-random-secret
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60
```

`JWT_SECRET` is required and must never be committed. The repository includes safe placeholders in [.env.example](.env.example).

`get_current_user()` is implemented but has not been applied to the existing routes yet. New ride creation is currently disabled until the Google authentication flow supplies a user ID; it will not assign new rides to the legacy user.

To smoke-test token creation and validation without touching the database:

```bash
docker compose build api
docker compose run --rm --no-deps \
  -e JWT_SECRET='test-only-secret-that-is-at-least-32-bytes' \
  api python -c 'from app.auth import create_access_token, decode_access_token; token = create_access_token(123); print(token); print(decode_access_token(token))'
```

The final line should print `123`.

## Database Migrations

Alembic owns schema changes. For an existing Trail Pulse database created before migrations, record the original schema as the baseline, then apply the ownership migration:

```bash
docker compose up -d database
docker compose build api
docker compose run --rm --no-deps api alembic stamp 20260811_0001
docker compose run --rm --no-deps api alembic upgrade head
```

For a new, empty database, run only:

```bash
docker compose run --rm --no-deps api alembic upgrade head
```

The ownership migration creates `users`, adds `trips.user_id`, assigns all existing rides to a single `Legacy User`, and then enforces the foreign key without a database default for future rides.

## Database Tables

- `users` stores Trail Pulse account identities and profile details.
- `trips` stores the beginning and end of each ride.
- `location_points` stores ordered GPS samples collected during a ride.
- `interactions` stores greeting results with their time and location.

To open PostgreSQL inside its container:

```bash
docker compose exec database sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Useful queries:

```sql
SELECT * FROM trips ORDER BY started_at DESC;

SELECT *
FROM location_points
ORDER BY trip_id DESC, sequence_number;

SELECT *
FROM interactions
ORDER BY trip_id DESC, recorded_at;
```

## Planned Improvements

- Offline storage and automatic upload retries
- Background GPS tracking
- Ride filters and search
- Google sign-in integration and authenticated ride creation

## Privacy

Trail Pulse records the rider's route and anonymous observations about brief trail interactions. It does not record names, photographs, audio, or identifying information about other trail users. Treat location data as private and protect it before deploying the app publicly.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
