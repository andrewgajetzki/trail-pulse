export type TripSummary = {
  id: number;
  started_at: number;
  ended_at: number;
  location_point_count: number;
  interaction_count: number;
};

export type LocationPoint = {
  recorded_at: number;
  sequence_number: number;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
};

export type Interaction = {
  recorded_at: number;
  latitude: number;
  longitude: number;
  interaction_type: "Greeted me" | "No response";
};

export type TripDetail = TripSummary & {
  location_points: LocationPoint[];
  interactions: Interaction[];
};