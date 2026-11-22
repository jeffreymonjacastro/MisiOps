# Data Model: Month-End Forecast PoC

| Entity | Fields | Constraints and lifecycle |
| --- | --- | --- |
| Transaction | Existing fields plus timezone-aware `created_at` | Set by the database for new records. Legacy records with unknown provenance remain null. `transaction_date` remains the occurrence time. |
| Synthetic snapshot | Dataset version and source, generator version and seed, bounds, hash, transaction IDs and dates | Numeric positive amounts, explicit income/expense types, unique IDs, chronological occurrence/recording timestamps, at least 12 completed months. Fixed version on replay. |
| Prepared forecast | Pseudonymous user, month, cutoff, feature contract, cumulative and recent flows, historical cutoff-aligned features, net label | All features computed from known inputs. Labels use the settlement policy. Month boundaries and observation groups determine partitions. |
| Approved model | Model ID, model kind, feature contract, environment, training snapshot digest, training revision, artifact checksum, validation bands, drift references and reports | Candidate → accepted or rejected. Only an accepted and explicitly selected manifest can be packaged. Bundle is matched to the runtime by its fingerprint. |
| Prediction observation | User FK, cutoff timestamp, month start/end, version and feature contract, forecast cents, cutoff band, selected aggregate feature values, settled close and evaluation timestamp | Owner scoped, timestamped, append-only forecast values. User deletion cascades. Evaluation finalizes eligible observations once after the grace period and does not overwrite earlier outcomes. Log publication uses aggregate metrics only. |

The month-end target and all report joins use the month boundary and owner. Exact amounts are recorded in PostgreSQL as numeric values or integer cents. Features use finite floating-point values for model input. `user_id` and custom category identifiers are excluded from the feature vector.
