import * as SQLite from "expo-sqlite";

export type SavedLocationPoint = {
    timestamp: number;
    latitude: number;
    longitude: number;
    accuracy: number | null;
    speed: number | null;
    heading: number | null;
};

export type SavedInteraction = {
    type: string;
    timestamp: number;
    latitude: number;
    longitude: number;
};

type SaveRideArguments = {
    startedAt: number;
    endedAt: number;
    locationPoints: SavedLocationPoint[];
    interactions: SavedInteraction[];
};

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDatabase() {
    if (!databasePromise) {
        databasePromise = SQLite.openDatabaseAsync("trail-pulse.db");
    }

    const database = await databasePromise;

    await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at INTEGER NOT NULL,
      ended_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS location_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      sequence_number INTEGER NOT NULL,
      recorded_at INTEGER NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      accuracy REAL,
      speed REAL,
      heading REAL,
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      recorded_at INTEGER NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      interaction_type TEXT NOT NULL,
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
    );
  `);

    return database;
}

export async function initializeDatabase() {
    await getDatabase();
}

export async function saveRide({
                                   startedAt,
                                   endedAt,
                                   locationPoints,
                                   interactions,
                               }: SaveRideArguments) {
    const database = await getDatabase();
    let tripId = 0;

    await database.withTransactionAsync(async () => {
        const tripResult = await database.runAsync(
            `
        INSERT INTO trips (started_at, ended_at)
        VALUES (?, ?)
      `,
            startedAt,
            endedAt,
        );

        tripId = tripResult.lastInsertRowId;

        for (const [index, point] of locationPoints.entries()) {
            await database.runAsync(
                `
          INSERT INTO location_points (
            trip_id,
            sequence_number,
            recorded_at,
            latitude,
            longitude,
            accuracy,
            speed,
            heading
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
                tripId,
                index,
                point.timestamp,
                point.latitude,
                point.longitude,
                point.accuracy,
                point.speed,
                point.heading,
            );
        }

        for (const interaction of interactions) {
            await database.runAsync(
                `
          INSERT INTO interactions (
            trip_id,
            recorded_at,
            latitude,
            longitude,
            interaction_type
          )
          VALUES (?, ?, ?, ?, ?)
        `,
                tripId,
                interaction.timestamp,
                interaction.latitude,
                interaction.longitude,
                interaction.type,
            );
        }
    });

    return tripId;
}

export async function getSavedRideCount() {
    const database = await getDatabase();

    const result = await database.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM trips",
    );

    return result?.count ?? 0;
}
