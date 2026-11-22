# Forecast and Release Contract

## Dashboard API

An authenticated `GET /api/v1/predictions/month-end` derives its owner from the session. For a forecast, return availability, signed net, PEN, period bounds, cutoff, model version, error band and one of `expected_surplus`, `expected_deficit`, or `tight_close`. Round amount and band to cents before classification. The inclusive band bounds are both tight.

For insufficient history or a disabled or unavailable model, return an explicit unavailable reason and no numeric estimate. Require authentication. Set private, non-cacheable response semantics. Use the same feature builder for the authenticated live path and replay.

## Build contract

The approval manifest pins a reviewed synthetic model artifact, metadata, feature-contract version, digest, source revision, dataset fingerprint and evaluation decision. The build verifies the hash, a passing report and supported format before using the bundle. Test the actual packaged API at matchable owner and cutoff using fixture history with a late transaction. No AWS credentials are needed for PR builds. The scanned backend image contains the exact model tested in that build.

The forecasting runtime can be disabled independently of the ledger outside release validation. A candidate image with an expected model must fail the AWS deployment readiness probe if the bundle is invalid. The probe exposes health and model version only. Post-deploy probes verify the expected release version.

Call the deployment from the gated DevSecOps push run. The reusable job must inherit its caller's ref and consume the scanned image artifact from the same run. Reject PR and manual CI triggers for deployment. The environment must independently enforce its branch rule.

| Workflow path | Allowed trigger | Outcome |
| --- | --- | --- |
| PR checks | Pull request | Synthetic tests and no cloud deployment |
| MLOps staging (`dev`) | `develop` | Candidate training and gate, plus version and parity verification of an accepted release in dev |
| MLOps production (`prod`) | `main` with protected environment approval | Verify the staged artifact and evidence, deploy via DevSecOps, and verify the served version. Production never fits a candidate. |

## Monitor contract

The Python monitor accepts a reproducible synthetic scenario or a bounded set of actual observations from an environment-bound batch task. It emits structured version-, cutoff- and cohort-aware counts, availability, drift and delayed quality metrics. Compare like cutoffs and model versions, report inadequate sample sizes, and avoid sending raw user records to workflow logs.

A scheduled or manual run can recommend retraining and trigger an independent candidate run with newer labeled synthetic data. It never changes the release manifest directly. Jobs use a separate least-privilege OIDC role for the monitor task if launched from Actions, and the task receives its own AWS and database authorization.
