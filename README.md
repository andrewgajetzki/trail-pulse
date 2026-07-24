# Trail Pulse

Trail Pulse is a mobile trip-tracking app for recording social interactions on Calgary bike trails.

During a ride, the app records GPS points and lets the rider quickly log whether another trail user returned a greeting. When the ride ends, the complete trip is sent to a FastAPI backend and stored in PostgreSQL.

## Background and Motivation

The idea came from regular bike rides around Calgary reservoirs and trails. On some rides, nearly everyone seems to return a greeting, smile, or nod. On other days, people appear more distracted, avoid eye contact, or do not respond.

Trail Pulse was created to record those observations more consistently instead of relying only on memory. By connecting each interaction to a time and location, the project can eventually explore whether greeting responses vary by route, time of day, trail traffic, weather, or other conditions.



## Current Features

- Start and stop a bike ride
- Record GPS coordinates during the ride
- Log two interaction types:
  - 🙂 Greeted me
  - 😐 No response
- Associate each interaction with a timestamp and GPS location
- Upload completed rides to a Python API
- Store trips, GPS points, and interactions in PostgreSQL

## Planned Features

- Ride history dashboard
- Route overlays on an interactive map
- Smiley and neutral markers at interaction locations
- Trip summaries and greeting-return percentages
- Filters by date, time, route, and interaction type
- Offline storage and automatic upload retries
- Background GPS tracking
- Authentication and private user data

## Technology

### Mobile

- React Native
- Expo
- TypeScript
- Expo Location
- Expo Router

### Backend

- Python
- FastAPI
- SQLAlchemy
- Psycopg

### Database

- PostgreSQL
- Docker Compose

### Planned Dashboard

- React
- TypeScript
- Interactive mapping library

## Project Structure

```text
trail-pulse/
├── apps/
│   ├── api/
│   │   └── app/
│   │       ├── __init__.py
│   │       ├── database.py
│   │       ├── main.py
│   │       ├── models.py
│   │       └── schemas.py
│   └── mobile/
│       ├── app/
│       ├── assets/
│       ├── components/
│       ├── hooks/
│       └── lib/
│           ├── api.ts
│           └── database.ts
├── docker-compose.yml
└── README.md
```

## Prerequisites

Install the following:

- Git
- Docker and Docker Compose
- Python 3
- Node.js and npm
- Expo Go on an Android or iOS device

The phone and development computer must be connected to the same local network when testing the mobile app against the local API.

## Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd trail-pulse
```

### 2. Start PostgreSQL

```bash
docker compose up -d
```

Confirm that the database container is running:

```bash
docker compose ps
```

### 3. Set up the Python API

```bash
cd apps/api

python3 -m venv .venv
source .venv/bin/activate

python -m pip install --upgrade pip
pip install "fastapi[standard]" sqlalchemy "psycopg[binary]" alembic
```

Start the API so it is accessible from other devices on the local network:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The API documentation is available at:

```text
http://localhost:8000/docs
```

The health endpoint is available at:

```text
http://localhost:8000/health
```

### 4. Find the computer's local IP address

On Linux:

```bash
ip route get 1.1.1.1 | awk '{print $7; exit}'
```

Example:

```text
192.168.1.123
```

### 5. Configure the mobile app

Create `apps/mobile/.env`:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.123:8000
```

Replace `192.168.1.123` with the development computer's actual local IP address.

Do not commit `.env` files.

### 6. Start the mobile app

```bash
cd apps/mobile
npm install
npx expo start
```

Scan the QR code using Expo Go.

## API

### Health check

```http
GET /health
```

Example response:

```json
{
  "status": "ok",
  "database": "connected"
}
```

### Save a trip

```http
POST /trips
```

Example request:

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

Example response:

```json
{
  "id": 1,
  "location_point_count": 1,
  "interaction_count": 1
}
```

## Database Tables

### `trips`

Stores the beginning and end of each ride.

### `location_points`

Stores ordered GPS samples collected during a ride.

### `interactions`

Stores greeting results along with their time and location.

## Inspecting the Database

Open PostgreSQL:

```bash
docker exec -it trail-pulse-database \
  psql -U trail_pulse -d trail_pulse
```

List tables:

```sql
\dt
```

View trips:

```sql
SELECT * FROM trips ORDER BY id DESC;
```

View GPS points:

```sql
SELECT *
FROM location_points
ORDER BY trip_id DESC, sequence_number;
```

View interactions:

```sql
SELECT *
FROM interactions
ORDER BY trip_id DESC, recorded_at;
```

Exit PostgreSQL:

```sql
\q
```

## Development Status

Trail Pulse is an early-stage project.

The current milestone is a complete basic data flow:

```text
Start ride
→ collect GPS points
→ record interactions
→ stop ride
→ send trip to FastAPI
→ store trip in PostgreSQL
```

The next major milestone is a web dashboard that displays saved rides and interaction markers on a map.

## Privacy

Trail Pulse records the rider's route and anonymous observations about brief trail interactions.

The project does not record names, photographs, audio, or identifying information about other trail users. Location data should be treated as private and protected appropriately before the app is deployed publicly.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.