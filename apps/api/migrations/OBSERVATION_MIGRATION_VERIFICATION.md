# Observation migration verification

Run these queries after applying revision `20260818_0003`. Each query must return zero rows before any future migration removes the legacy `observations.interaction_type` column.

```sql
SELECT t.id
FROM trips t
LEFT JOIN observation_profiles p ON p.id = t.observation_profile_id
WHERE p.id IS NULL OR p.user_id <> t.user_id;

SELECT o.id
FROM observations o
JOIN trips t ON t.id = o.trip_id
LEFT JOIN observation_types ot ON ot.id = o.observation_type_id
WHERE ot.id IS NULL OR ot.profile_id <> t.observation_profile_id;

SELECT o.id, o.interaction_type, ot.label
FROM observations o
JOIN observation_types ot ON ot.id = o.observation_type_id
WHERE (o.interaction_type = 'Greeted me' AND ot.label <> 'Greeted us')
   OR (o.interaction_type = 'No response' AND ot.label <> 'No response');
```

Also record row counts for audit purposes:

```sql
SELECT count(*) AS observations FROM observations;
SELECT count(*) AS location_points FROM location_points;
SELECT count(*) AS trips FROM trips;
```
