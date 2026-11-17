#!/usr/bin/env bash
# Tests for security/scripts/upload_to_defectdojo.sh and import_run.sh (NFR-006).
# Cases follow specs/011-devsecops/contracts/upload-script.md. curl and gh are stubbed.
set -uo pipefail

root=$(cd "$(dirname "$0")/../.." && pwd)
upload="$root/security/scripts/upload_to_defectdojo.sh"
import_run="$root/security/scripts/import_run.sh"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/bin"

# curl stub: logs its argv (one per line), copies the uploaded file and the auth header,
# writes a body to the -o file and prints $STUB_STATUS as the -w output.
cat > "$work/bin/curl" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$@" >> "$CALLS"
echo '---' >> "$CALLS"
out=
while [ $# -gt 0 ]; do
  case $1 in
    -o) out=$2; shift ;;
    -H) [[ $2 == @* ]] && cat "${2#@}" >> "$HEADERS"; shift ;;
    -F) [[ $2 == file=@* ]] && cat "${2#file=@}" > "$UPLOADED"; shift ;;
  esac
  shift
done
echo '{"detail":"stub"}' > "$out"
printf '%s' "${STUB_STATUS:-201}"
EOF
# gh stub: `gh run download <id> ... -D <dir>` drops fixture reports; `gh run view` prints a branch.
cat > "$work/bin/gh" <<'EOF'
#!/usr/bin/env bash
if [ "$1 $2" = "run view" ]; then echo "feature/x"; exit 0; fi
while [ $# -gt 0 ]; do [ "$1" = "-D" ] && dir=$2; shift; done
mkdir -p "$dir/report-sast" "$dir/report-dast"
echo '{"results":[]}' > "$dir/report-sast/semgrep.json"
echo '<OWASPZAPReport/>' > "$dir/report-dast/zap-api.xml"
EOF
chmod +x "$work/bin/curl" "$work/bin/gh"

export PATH="$work/bin:$PATH" CALLS="$work/calls" HEADERS="$work/headers" UPLOADED="$work/uploaded"
fail=0
reset() { : > "$CALLS"; : > "$HEADERS"; : > "$UPLOADED"; }
check() { if eval "$2"; then echo "ok   - $1"; else echo "FAIL - $1"; fail=1; fi; }
run() { out=$("$@" 2>&1); code=$?; }

echo '[{"RuleID":"aws-access-token"}]' > "$work/gitleaks.json"
export DEFECTDOJO_URL=https://dd.example.test/ DEFECTDOJO_TOKEN=tok-SECRET-123
unset GITHUB_HEAD_REF GITHUB_REF_NAME GITHUB_RUN_ID GITHUB_SHA DEFECTDOJO_ENGAGEMENT

reset; run "$upload" "Gitleaks Scan" "Gitleaks - history"
check "fewer than 3 arguments exits 2 with usage" '[ $code -eq 2 ] && [[ $out == *usage* ]]'

reset; run "$upload" "Gitleaks Scan" "Gitleaks - history" "$work/missing.json"
check "missing report exits 0 with skip" '[ $code -eq 0 ] && [[ $out == "skip: "*"not found"* ]] && [ ! -s "$CALLS" ]'

reset; DEFECTDOJO_URL= run "$upload" "Gitleaks Scan" "Gitleaks - history" "$work/gitleaks.json"
check "unset DEFECTDOJO_URL exits 1" '[ $code -eq 1 ] && [[ $out == *"missing variable: DEFECTDOJO_URL"* ]]'

reset; DEFECTDOJO_TOKEN= run "$upload" "Gitleaks Scan" "Gitleaks - history" "$work/gitleaks.json"
check "unset DEFECTDOJO_TOKEN exits 1" '[ $code -eq 1 ] && [[ $out == *"missing variable: DEFECTDOJO_TOKEN"* ]]'

reset; run "$upload" "Gitleaks Scan" "Gitleaks - history" "$work/gitleaks.json"
check "HTTP 201 exits 0 with ok" '[ $code -eq 0 ] && [[ $out == "ok: Gitleaks - history"* ]]'
check "posts to reimport-scan without double slash" 'grep -qx "https://dd.example.test/api/v2/reimport-scan/" "$CALLS"'
for field in "scan_type=Gitleaks Scan" "test_title=Gitleaks - history" "product_name=MisiOps" \
             "product_type_name=Aplicaciones Web" "engagement_name=CI - local" \
             "auto_create_context=true" "close_old_findings=true" "active=true" "verified=false"; do
  check "sends $field" 'grep -qxF "$field" "$CALLS"'
done
check "sends the report file" 'cmp -s "$UPLOADED" "$work/gitleaks.json"'
check "auth header is Token <token>" 'grep -qx "Authorization: Token tok-SECRET-123" "$HEADERS"'
check "token never on argv" '! grep -q "tok-SECRET-123" "$CALLS"'
check "token never on output" '[[ $out != *tok-SECRET-123* ]]'

reset; GITHUB_HEAD_REF=feature/devsecops GITHUB_RUN_ID=42 GITHUB_SHA=abc GITHUB_REF_NAME=7/merge \
  run "$upload" "Gitleaks Scan" "Gitleaks - history" "$work/gitleaks.json"
check "engagement uses the PR head branch" 'grep -qxF "engagement_name=CI - feature/devsecops" "$CALLS"'
check "sends build_id and commit_hash" 'grep -qx "build_id=42" "$CALLS" && grep -qx "commit_hash=abc" "$CALLS"'

reset; STUB_STATUS=500 run "$upload" "Gitleaks Scan" "Gitleaks - history" "$work/gitleaks.json"
check "HTTP 500 exits 1 with error and body" '[ $code -eq 1 ] && [[ $out == *"error 500"*stub* ]] && [[ $out != *tok-SECRET-123* ]]'

printf '%s\n' '{"level":"info","msg":"scanning"}' '{"SourceMetadata":{"Data":{}},"DetectorName":"AWS"}' > "$work/th.json"
reset; run "$upload" "Trufflehog Scan" "TruffleHog - history" "$work/th.json"
check "TruffleHog report filtered to finding lines" '[ $code -eq 0 ] && [ "$(wc -l < "$UPLOADED")" -eq 1 ] && grep -q SourceMetadata "$UPLOADED"'

: > "$work/empty.json"
reset; run "$upload" "Trufflehog Scan" "TruffleHog - history" "$work/empty.json"
check "zero-finding report is still uploaded" '[ $code -eq 0 ] && grep -qxF "scan_type=Trufflehog Scan" "$CALLS"'

reset; run "$import_run"
check "import_run without arguments exits 2" '[ $code -eq 2 ] && [[ $out == *usage* ]]'

reset; run "$import_run" 12345
uploads=$(grep -c '^scan_type=' "$CALLS")
rows=$(grep -cv '^\(#\|$\)' "$root/security/scripts/reports.tsv")
check "import_run calls upload once per reports.tsv row" '[ "$uploads" -eq 2 ] && [ "$rows" -eq 11 ]'
check "import_run skips reports absent from the run" '[[ $out == *"skip: "*"trivy-deps.json not found"* ]]'
check "import_run uses the run branch as engagement" 'grep -qxF "engagement_name=CI - feature/x" "$CALLS"'
check "import_run exits 0 when every upload succeeds or skips" '[ $code -eq 0 ]'

reset; mkdir -p "$work/dir/report-sca" && echo '{}' > "$work/dir/report-sca/trivy-deps.json"
run "$import_run" "$work/dir"
check "import_run accepts a local directory" '[ $code -eq 0 ] && grep -qxF "test_title=Trivy - dependencies" "$CALLS"'
check "import_run on a directory uses the checked-out branch as engagement"   'grep -qxF "engagement_name=CI - $(git -C "$root" rev-parse --abbrev-ref HEAD)" "$CALLS"'

gate="$root/security/scripts/gate.sh"
export GITHUB_STEP_SUMMARY="$work/summary"
ENFORCE=true run "$gate" Semgrep 0
check "gate passes with zero findings" '[ $code -eq 0 ]'
ENFORCE=true run "$gate" Semgrep 3
check "gate blocks when enforcing (main)" '[ $code -eq 1 ] && [[ $out == "::error::"* ]]'
ENFORCE=false run "$gate" Semgrep 3
check "gate only warns when report-only (develop, EX-001)" '[ $code -eq 0 ] && [[ $out == "::warning::"* ]]'
check "gate writes the step summary" 'grep -q "Semgrep\*\*: 3 blocking findings (report-only)" "$GITHUB_STEP_SUMMARY"'

blocking="$root/security/scripts/trivy-blocking.jq"
cat > "$work/trivy.json" <<'EOF'
{"Results":[{"Vulnerabilities":[
  {"Severity":"HIGH","FixedVersion":"1.2"},{"Severity":"CRITICAL","FixedVersion":""},
  {"Severity":"CRITICAL"},{"Severity":"MEDIUM","FixedVersion":"2.0"}]},
 {"Misconfigurations":[{"Severity":"HIGH"},{"Severity":"LOW"}],"Secrets":[{"RuleID":"aws"}]}]}
EOF
check "trivy filter counts fixable HIGH/CRITICAL, HIGH misconfig and secrets" '[ "$(jq -f "$blocking" "$work/trivy.json")" -eq 3 ]'
check "trivy filter handles a clean report" '[ "$(echo "{}" | jq -f "$blocking")" -eq 0 ]'

exit $fail
