# Forecast and Release Contract

## Dashboard API

An authenticated `GET /api/v1/predictions/month-end` derives its owner from the session. For a forecast, return availability, signed net, PEN, period bounds, cutoff, model version, error band and one of `expected_surplus`, `expected_deficit`, or `tight_close`. Round amount and band to cents before classification. The inclusive band bounds are both tight.

For insufficient history or a disabled or unavailable model, return an explicit unavailable reason and no numeric estimate. Require authentication. Set private, non-cacheable response semantics. Use the same feature builder for the authenticated live path and replay.

## Build contract

The approval manifest pins a reviewed synthetic model artifact, metadata, feature-contract version, digest, source revision, dataset fingerprint and evaluation decision. The build verifies the hash, a passing report and supported format before using the bundle. Test the actual packaged API at matchable owner and cutoff using fixture history with a late transaction. No AWS credentials are needed for PR builds. The scanned backend image contains the exact model tested in that build.

The forecasting runtime can be disabled independently of the ledger outside release validation. A candidate image with an expected model must fail the AWS deployment readiness probe if the bundle is invalid. The probe exposes health and model version only. Post-deploy probes verify the expected release version.

Use exactly these visible jobs in `mlops.yml`: Tests → Data Validation → Data Preparation → Modeling → Evaluation → Smoke Test → Build and Publish, followed by Deploy · Staging and Deploy · Production. Reuse same-run image artifacts and shared DevSecOps security steps. PRs run Tests. Staging can run on a `develop` push or an explicit manual training release. Production requires a `main` push. Each environment independently enforces its branch rule.

| Workflow path | Allowed trigger | Outcome |
| --- | --- | --- |
| PR checks | Pull request | Synthetic tests and no cloud deployment |
| MLOps staging (`dev`) | `develop` | Candidate training and gate, plus version and parity verification of an accepted release in dev |
| MLOps production (`prod`) | `main` with protected environment approval | Verify the staging receipt, reuse shared security gates and verify the deployed model version. Production never fits a candidate. |

## Monitor contract

The Python monitor accepts a reproducible synthetic scenario or a bounded set of actual observations from an environment-bound batch task. It emits structured version-, cutoff- and cohort-aware counts, availability, drift and delayed quality metrics. Compare like cutoffs and model versions, report inadequate sample sizes, and avoid sending raw user records to workflow logs.

A scheduled or manual run can recommend retraining and trigger an independent candidate run with newer labeled synthetic data. It never changes the release manifest directly. Jobs use a separate least-privilege OIDC role for the monitor task if launched from Actions, and the task receives its own AWS and database authorization.
