# Energy support list performance issue

The candidate list can currently execute separate case, detail, and activity
queries for each senior. This can become an N+1 query problem as the list grows.

## Planned optimization

1. Load the target senior IDs once.
2. Bulk-load `EnergySupportCase` rows by `seniorId IN (...)` and support type.
3. Bulk-load voucher, electricity, and gas details by `seniorId IN (...)`.
4. Bulk-load activities and group them by senior ID and support type in memory.
5. If the list only needs the latest activity, add a dedicated latest-activity
   projection and load the full history only when a detail modal opens.

## Completion criteria

- Candidate-list query count remains fixed as the number of seniors increases.
- Record query count and response time with 100 seniors.
- ACTIVE, COMPLETED, and ALL filters return the same results as before.
