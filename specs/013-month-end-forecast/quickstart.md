# Validation Quickstart

1. Use Docker and the repository's Compose development setup. Start local MLflow with a persistent volume and generate synthetic data using the documented simulator command in the implementation README.
2. Run the data-contract, feature, temporal-split and regression tests. Introduce an invalid duplicate and confirm that the data gate blocks training.
3. Run the full synthetic pipeline and open the MLflow UI. Find the baseline and four candidate runs, independently evaluated report, model card, error bands, artifact and release checksum. Repeat with a stricter threshold to show rejection without replacing the previous approval.
4. Start MisiOps with the selected bundle. Seed a dedicated demo account and transaction history or use the integration fixture. Verify the forecast card, all balance states, the unavailable state and owner isolation. Compare the real API and offline predictions to within one cent.
5. Run the monitor on stable data and two scenarios. Verify that open-month drift is reported without error metrics, and that a closed-month degradation reports measured error and a retraining recommendation.
6. After the team enables the dedicated monitor role and completes the normal release to `dev`, inspect the Actions run, ECR digest, ECS version/readiness, forecast response, and CloudWatch logs. Exercise rollback only in a test environment and check the previous release.
