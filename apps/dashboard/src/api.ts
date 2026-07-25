import type { TripDetail, TripSummary } from "./types";

const API_URL = import.meta.env.VITE_API_URL;

function requireApiUrl(): string {
  if (!API_URL) {
    throw new Error("VITE_API_URL is not configured");
  }

  return API_URL;
}

export async function getTrips(): Promise<TripSummary[]> {
  const response = await fetch(`${requireApiUrl()}/trips`);

  if (!response.ok) {
    throw new Error(`Could not load trips: ${response.status}`);
  }

  return response.json();
}

export async function getTrip(tripId: number): Promise<TripDetail> {
  const response = await fetch(`${requireApiUrl()}/trips/${tripId}`);

  if (response.status === 404) {
    throw new Error("Trip not found");
  }

  if (!response.ok) {
    throw new Error(`Could not load trip: ${response.status}`);
  }

  return response.json();
}