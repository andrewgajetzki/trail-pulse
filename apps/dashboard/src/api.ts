import type { TripSummary } from "./types";

const API_URL = import.meta.env.VITE_API_URL;

export async function getTrips(): Promise<TripSummary[]> {
  if (!API_URL) {
    throw new Error("VITE_API_URL is not configured");
  }

  const response = await fetch(`${API_URL}/trips`);

  if (!response.ok) {
    throw new Error(`Could not load trips: ${response.status}`);
  }

  return response.json();
}