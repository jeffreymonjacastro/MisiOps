#!/usr/bin/env bash
# Upload one scan report to DefectDojo through /api/v2/reimport-scan/.
# Contract: specs/011-devsecops/contracts/upload-script.md
# Usage: upload_to_defectdojo.sh <scan_type> <test_title> <report_file>
set -euo pipefail

if [ $# -lt 3 ]; then
  echo "usage: $0 <scan_type> <test_title> <report_file>" >&2
  exit 2
fi
scan_type=$1 test_title=$2 report=$3

# A missing file means the scanner did not run; a zero-finding report is still uploaded
# so close_old_findings can close what an earlier run found.
if [ ! -f "$report" ]; then
  echo "skip: $report not found"
  exit 0
fi
for var in DEFECTDOJO_URL DEFECTDOJO_TOKEN; do
  if [ -z "${!var:-}" ]; then
    echo "missing variable: $var" >&2
    exit 1
  fi
done

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# TruffleHog writes log lines next to findings; DefectDojo only parses the findings.
if [ "$scan_type" = "Trufflehog Scan" ]; then
  grep '"SourceMetadata"' "$report" > "$tmp/trufflehog.json" || true
  report=$tmp/trufflehog.json
fi

# Header from a file keeps the token off the process list and out of logs.
printf 'Authorization: Token %s\n' "$DEFECTDOJO_TOKEN" > "$tmp/auth"

form=(
  -F "scan_type=$scan_type"
  -F "test_title=$test_title"
  -F "file=@$report"
  -F "product_name=${DEFECTDOJO_PRODUCT:-MisiOps}"
  -F "product_type_name=${DEFECTDOJO_PRODUCT_TYPE:-Aplicaciones Web}"
  -F "engagement_name=${DEFECTDOJO_ENGAGEMENT:-CI - ${GITHUB_HEAD_REF:-${GITHUB_REF_NAME:-local}}}"
  -F "auto_create_context=true"
  -F "close_old_findings=true"
  -F "active=true"
  -F "verified=false"
)
[ -n "${GITHUB_RUN_ID:-}" ] && form+=(-F "build_id=$GITHUB_RUN_ID")
[ -n "${GITHUB_SHA:-}" ] && form+=(-F "commit_hash=$GITHUB_SHA")
[ -n "${GITHUB_REF_NAME:-}" ] && form+=(-F "branch_tag=${GITHUB_HEAD_REF:-$GITHUB_REF_NAME}")

status=$(curl -sS -o "$tmp/body" -w '%{http_code}' -X POST \
  "${DEFECTDOJO_URL%/}/api/v2/reimport-scan/" -H "@$tmp/auth" "${form[@]}")

if [ "$status" = "201" ]; then
  echo "ok: $test_title"
else
  echo "error $status: $(cat "$tmp/body")" >&2
  exit 1
fi
