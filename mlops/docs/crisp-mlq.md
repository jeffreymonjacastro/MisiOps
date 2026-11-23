# CRISP-ML(Q) decision record

The project adapts the course's [Guide 11](<../../guides/laboratorio_mlops/11. mlops-churn-crisp-mlq-parte-1.md>) and [Guide 12](<../../guides/laboratorio_mlops/12. mlops-churn-crisp-mlq-parte-2.md>). MisiOps predicts a continuous amount from time-dependent observations, so it uses chronological validation and monetary error metrics.

| Phase | Main risk | Control and evidence |
| --- | --- | --- |
| Business and data | An unrealistic or malformed dataset overstates confidence | Use named synthetic profiles with delayed recording and exceptional expenses. Check unique IDs, amount, currency, both clocks, checksum and coverage before preparing data. |
| Preparation | A late registration leaks or online features differ | Use occurrence and knowledge timestamps and the same feature code offline and online. Keep each calendar month together, leave an embargo month, and verify that the labels were known before each validation window. |
| Modeling | Flexible algorithms overfit or add no value | Compare the same-day historical rule, multiple linear regression, Ridge, Random Forest and Gradient Boosting through expanding validation folds. Log runs and selection evidence in MLflow. |
| Evaluation | Reported test scores drive tuning or near-zero abstentions conceal missed deficits | Choose on validation MAE. Use the median absolute error within each validation cutoff bucket as the display band. Freeze the model before opening held-out months. Count a tight close on an actual deficit as missed. Require an improvement over the baseline, at least 15 held-out deficits and at most 65% missed deficits. |
| Deployment | The packaged API behaves differently or a version bypasses review | Verify approved checksums and load only supported, version-matched model types. Run authenticated parity on the scanned image, verify the served version in staging, and require staging evidence and human review for production. |
| Monitoring | Input drift is mistaken for lost accuracy, or outcome labels come too late | Compare PSI by comparable time-of-month buckets and require at least 30 observations. Alert on input or prediction drift at PSI 0.25. Settle labels after seven days. Recommend a candidate when observed MAE reaches more than 130% of the held-out reference. Keep review gates. |

The target is recorded monthly income minus expenses. Labels reflect transactions registered before the settlement deadline. The current month uses all eligible known movements. Historical features use up to three months, with two months of activity required. Zero and the inclusive bounds belong to the tight-close status. Observation duplicates are reduced within each month and cutoff group at evaluation time.

The first 36-month pilot used MAE as the band and was rejected for missed deficits. The revised method uses the median validation absolute error and a known calendar feature for July and December. Thresholds were kept fixed and the six previously unseen months in 2026 were reserved for final testing. The accepted candidate and its evidence are in `backend/forecast_release/`.
