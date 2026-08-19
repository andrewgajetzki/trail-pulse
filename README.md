# Trail Pulse

Trail Pulse is a mobile app for recording bike rides and location-based trail observations. Riders sign in with Google, choose an observation profile, record GPS points and observations during a ride, then review their history and route maps.

## Architecture

```text
Expo app ── HTTPS /api ──► Caddy ──► FastAPI ──► PostgreSQL
```

The FastAPI service owns authentication, rides, observation profiles, and data persistence. Caddy publishes only `/api/*`; it removes that prefix before forwarding to FastAPI. The mobile app is configured from the repository-root `.env` during local development and with EAS environment variables for cloud builds.

## Repository layout

```text
trail-pulse/
├── apps/
│   ├── api/                 FastAPI service, Alembic migrations, and tests
│   └── mobile/              Expo / React Native app
├── Caddyfile                HTTPS reverse-proxy configuration
├── docker-compose.yml       API, PostgreSQL, and Caddy services
├── .env.example             Single local configuration template
└── README.md
```

## Requirements

- Docker Engine with Docker Compose (server and local API)
- Node.js 20.6+ and npm (the mobile commands use `node --env-file`)
- Android Studio / Android SDK for local Android builds
- An Expo account and EAS CLI for cloud builds
- A Google Cloud project for Google Sign-In and Android Maps

Expo Go is suitable for basic JavaScript development, but Google Sign-In and Google Maps require a development or release build.

## Configuration

Copy the one local configuration template at the repository root:

```bash
cp .env.example .env
```

Set every placeholder before deployment. `JWT_SECRET` must be a long, random value; for example:

```bash
openssl rand -hex 32
```

The root `.env` contains both server and local-mobile settings:

| Setting | Used by | Notes |
| --- | --- | --- |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | PostgreSQL | Persistent database credentials |
| `JWT_SECRET`, `JWT_ALGORITHM`, `JWT_EXPIRE_MINUTES` | API | Token signing configuration |
| `GOOGLE_CLIENT_ID` | API | Google Web OAuth client ID used to verify ID tokens |
| `SITE_ADDRESS` | Caddy | Public hostname, such as `trails.example.com` |
| `EXPO_PUBLIC_API_URL` | mobile | Public API base URL ending in `/api` |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | mobile | Same Web OAuth client ID as `GOOGLE_CLIENT_ID` |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | mobile | Restricted Android Maps SDK key |

Values prefixed `EXPO_PUBLIC_` are embedded in the mobile bundle. Do not put secrets in them. `.env` is ignored by Git and must never be committed.

For local mobile testing, set `EXPO_PUBLIC_API_URL` to the development computer's LAN address, for example `http://192.168.1.123/api`; do not use `localhost` from a physical phone.

## Local development

### Start the API stack

From the repository root:

```bash
docker compose up --build -d
docker compose run --rm --no-deps api alembic upgrade head
curl http://localhost/api/health
```

The API documentation is available at `http://localhost/api/docs`. Inspect logs with `docker compose logs -f api`, and stop the stack with `docker compose down`. The PostgreSQL volume remains intact after `down`.

### Start the mobile app

From `apps/mobile`:

```bash
npm install
npm run start
```

All Expo scripts load `../../.env`; do not create a mobile `.env.local`. Common commands are:

```bash
npm run lint
npm run start -- --clear
npm run android
npm run prebuild -- --clean
```

`npm run android` builds and installs a local Android development build. Run the prebuild command after changing native configuration, including the Android Maps key.

## Google configuration

Create these clients in one Google Cloud project:

1. Configure the OAuth consent screen and add testers when the app is in testing.
2. Create a **Web application** OAuth client. Put its client ID in both `GOOGLE_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
3. Create an **Android** OAuth client for package `com.andrewgajetzki.trailpulse` and every signing-certificate SHA-1 used for development, EAS/release, and Google Play.
4. Enable **Maps SDK for Android** and create a key restricted to that package and its signing certificates. Set it as `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`.

The app sends a Google ID token to `POST /api/auth/google`; the API verifies it, creates or updates the user, creates a default observation profile for a new user, and returns a Trail Pulse JWT.

## Deploy the API

Deploy the repository to a Linux server with Docker, Docker Compose, ports 80 and 443 available, and a DNS record for `SITE_ADDRESS` pointing at the server.

1. Create the server's root `.env` from `.env.example`. Use a production PostgreSQL password and JWT secret, set `SITE_ADDRESS` to the public hostname, and set `EXPO_PUBLIC_API_URL` to `https://<hostname>/api`.
2. Open inbound TCP ports 80 and 443 (and UDP 443 if your firewall supports HTTP/3).
3. Start or update the services and run migrations:

```bash
docker compose up -d --build
docker compose run --rm --no-deps api alembic upgrade head
docker compose ps
curl https://<hostname>/api/health
```

Caddy obtains and renews TLS certificates automatically when `SITE_ADDRESS` is a publicly resolvable hostname and ports 80/443 reach the server. Do not use an IP address as `SITE_ADDRESS` for a public TLS deployment.

For subsequent releases, pull the new revision, update `.env` only when required, then repeat the three commands above. Back up the named `postgres_data` volume before destructive database maintenance.

## Build and release the mobile app

Cloud EAS builds cannot read the ignored local root `.env`. Configure these EAS environment variables for each applicable build environment (development, preview, and production):

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`

In `apps/mobile`, sign in and create a build:

```bash
npx eas-cli login
npx eas-cli build --platform android --profile preview
```

Use the `development` profile for a development client, `preview` for internal distribution, and `production` for a store build. The production profile auto-increments the remote app version. Before a store release, ensure the Android OAuth client and Maps key include the EAS/Play signing SHA-1; then submit with:

```bash
npx eas-cli submit --platform android --profile production
```

## API overview

All API endpoints are under `/api` at the public proxy. Aside from `/health` and `POST /auth/google`, routes require `Authorization: Bearer <Trail Pulse JWT>`.

| Area | Endpoints |
| --- | --- |
| Health and account | `GET /health`, `POST /auth/google`, `GET /auth/me` |
| Observation profiles | `GET, POST /observation-profiles`, `GET, PATCH /observation-profiles/{id}` |
| Observation types | `POST /observation-profiles/{id}/types`, `PATCH /observation-types/{id}` |
| Rides | `GET, POST /trips`, `GET /trips/{id}` |

New rides require an active observation profile, at least one location point, and any observations must use active types belonging to the selected profile.

## Database migrations

Alembic owns schema changes. On an empty database, run:

```bash
docker compose run --rm --no-deps api alembic upgrade head
```

For a database created before Alembic was introduced, follow [the migration verification notes](apps/api/migrations/OBSERVATION_MIGRATION_VERIFICATION.md) and use the appropriate baseline stamp before upgrading.

## Privacy

Trail Pulse stores a rider's route and their observations. Location data is sensitive: protect database backups, restrict server access, and obtain appropriate consent before making data available to anyone else.

## License

MIT. See [LICENSE](LICENSE).
