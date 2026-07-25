import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { getTrips } from "../api";
import type { TripSummary } from "../types";

function formatDuration(trip: TripSummary): string {
  const milliseconds = trip.ended_at - trip.started_at;
  const minutes = Math.round(milliseconds / 60_000);

  return `${minutes} min`;
}

function TripListPage() {
  const tripsQuery = useQuery({
    queryKey: ["trips"],
    queryFn: getTrips,
  });

  return (
    <main className="page">
      <header>
        <p className="eyebrow">Trail Pulse</p>
        <h1>Ride history</h1>
        <p className="subtitle">
          Review recorded rides and trail interactions.
        </p>
      </header>

      {tripsQuery.isPending && <p>Loading rides...</p>}

      {tripsQuery.isError && (
        <p className="error">
          {tripsQuery.error instanceof Error
            ? tripsQuery.error.message
            : "Could not load rides."}
        </p>
      )}

      {tripsQuery.data?.length === 0 && (
        <p>No recorded rides yet.</p>
      )}

      <section className="trip-list">
        {tripsQuery.data?.map((trip) => (
          <article className="trip-card" key={trip.id}>
            <div>
              <h2>
                {new Date(trip.started_at).toLocaleDateString()}
              </h2>

              <p>
                {new Date(trip.started_at).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            </div>

            <dl>
              <div>
                <dt>Duration</dt>
                <dd>{formatDuration(trip)}</dd>
              </div>

              <div>
                <dt>GPS points</dt>
                <dd>{trip.location_point_count}</dd>
              </div>

              <div>
                <dt>Interactions</dt>
                <dd>{trip.interaction_count}</dd>
              </div>
            </dl>

              <Link className="view-button" to={`/trips/${trip.id}`}>
                  View ride
              </Link>
          </article>
        ))}
      </section>
    </main>
  );
}

    export default TripListPage;