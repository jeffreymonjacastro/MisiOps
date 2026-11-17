# Blocking findings in a Trivy JSON report (FR-012): fixable HIGH/CRITICAL vulnerabilities,
# HIGH/CRITICAL misconfigurations and any secret. Unfixed vulnerabilities are reported only.
[
  .Results[]?
  | (.Vulnerabilities[]? | select((.Severity == "HIGH" or .Severity == "CRITICAL") and ((.FixedVersion // "") != ""))),
    (.Misconfigurations[]? | select(.Severity == "HIGH" or .Severity == "CRITICAL")),
    (.Secrets[]?)
] | length
