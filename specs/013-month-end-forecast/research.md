# Research: Month-End Forecast PoC

## R1. Cutoffs and labels

**Decision**: Use calendar months in America/Lima and one currency (PEN). Prefer a causal replay of synthetic source events with a recording timestamp. Compare each post-cutoff forecast against a finalized month after a seven-day grace period.

**Rationale**: The existing date belongs to the transaction. The API can edit and delete rows. A creation timestamp prevents the late-entry error for new records, while persisted feature observations capture what really went into forecasts that were served.

**Alternatives considered**: Refitting against a snapshot of today's database would misrepresent historical edits. A full transaction event store is unnecessary for the PoC. Actual available balances require account and opening-balance data.

## R2. Temporal evaluation and error band

**Decision**: Use expanding monthly validation folds, latest complete months as final test, and group every cutoff of a month together. Define early, middle and late cuts as days 1–10, 11–20 and 21–end. Fit transformations inside each fold. Use the out-of-fold median absolute error of the chosen approach for each cutoff band, falling back to the pooled validation median for sparse buckets. The 36-month pilot using mean absolute error bands failed the unchanged deficit gate. Use an independent six-month final test in 2026 for the revised band and calendar features.

**Rationale**: Same-month rows are correlated and depend on one close. The band must be available before a future prediction. It expresses typical error and is not a prediction interval.

**Alternatives considered**: The churn lab's stratified folds are inappropriate for time-dependent rows. Using final test errors to determine bands weakens the final evaluation.

## R3. Tracking and release

**Decision**: Record each estimator and baseline as MLflow runs. Use durable local SQLite and artifact storage for Docker demos and retain run evidence as Actions artifacts in CI. Allow `MLFLOW_TRACKING_URI` to point to a shared authenticated tracking server. Use a stable approval manifest and content digest as the deployment authority across runs.

**Rationale**: The lab's CI storage is ephemeral. It cannot attest to an earlier champion without preserved artifacts. The approved deployment must remain usable if the tracking service is down.

**Alternatives considered**: Running a managed registry or additional public tracking service as a PoC prerequisite adds cost and networking. A floating registry alias cannot pin a released image.

## R4. Serving and batch monitoring

**Decision**: Reuse FastAPI, Aurora, CloudFront, the existing ECS ARM64 service and its CloudWatch Logs. Package the compatible non-executable model representation or an allowlisted serialized pipeline before the current DevSecOps build. Keep the approved synthetic bundle lightweight and available to credential-free PR builds. Execute DB-side monitoring locally in Compose and in AWS as a one-off task in the existing cluster.

**Rationale**: The existing app already routes authenticated API requests. An isolated Aurora instance is unreachable directly from the hosted runner. AWS supports one-off batch tasks within ECS. The same guarded pipeline gates model promotion and application deployment.

**Alternatives considered**: Private S3 is a useful next step for larger artifacts or private snapshots, but the small reviewed synthetic bundle can ship directly with the code and avoids storage credentials on PRs. SageMaker and Airflow would add services without an identified need. Use CloudWatch for cloud telemetry instead of requiring Prometheus or Grafana.

## R5. Schema compatibility

**Decision**: Apply an explicit, repeatable, additive schema upgrade before serving forecast routes. Keep existing creation times unknown, set a server default for new records, and store forecasts under user-delete cascade. Exercise both an empty database and a legacy PostgreSQL database.

**Rationale**: The current startup calls `create_all`, which does not alter existing columns. Unfounded backfill would introduce false availability evidence.

**Alternatives considered**: Destructive schema recreation and copying movement dates into creation dates violate the legacy requirements.

## R6. Deployment branch context

**Decision**: Run deployment as a reusable workflow called by the gated DevSecOps push run, with the scanned image artifact in that same run. Derive the target environment from the caller ref. Keep production approval and both current environment branch policies.

**Evidence**: [Deployment run 45059639991](https://github.com/jeffreymonjacastro/MisiOps/actions/runs/45059639991) selected dev but GitHub rejected the job before any steps because its ref was main. GitHub checks an environment's deployment rules against the run ref, and the current `workflow_run` trigger uses the default branch ref even when the triggering run was on develop. A reusable workflow retains the caller's GitHub context. See [trigger refs](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run), [deployment branch rules](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments#deployment-branches-and-tags), and [reusable workflow context](https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations#github-context).

**Alternatives considered**: Keep `workflow_run` and admit main into dev. This weakens the configured branch boundary and still does not test the intended ref. Rebuilding in the deploy job violates the scanned-image invariant.

Scheduled cloud monitoring can use EventBridge per environment. A manually dispatched GitHub cloud monitor must use the protected ref for its selected environment, because a GitHub schedule also runs on the default branch.

References: [MLflow Tracking Server](https://mlflow.org/docs/latest/self-hosting/architecture/tracking-server/), [scikit-learn model persistence](https://scikit-learn.org/stable/model_persistence.html), [ECS standalone tasks](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/standalone-tasks.html), and the course's [Guide 11](<../../guides/laboratorio_mlops/11. mlops-churn-crisp-mlq-parte-1.md>) and [Guide 12](<../../guides/laboratorio_mlops/12. mlops-churn-crisp-mlq-parte-2.md>).
