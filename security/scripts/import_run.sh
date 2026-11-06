#!/usr/bin/env bash
# Import every report of a pipeline run into DefectDojo (FR-011a).
# Usage: import_run.sh <run-id>   download the run's report artifacts with gh (fallback without tunnel)
#        import_run.sh <dir>      upload reports already on disk (used by the CI defectdojo job)
# Needs DEFECTDOJO_URL and DEFECTDOJO_TOKEN; the report list lives in reports.tsv.
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "usage: $0 <run-id|reports-dir>" >&2
  exit 2
fi
here=$(cd "$(dirname "$0")" && pwd)
repo=${GH_REPO:-jeffreymonjacastro/MisiOps}

if [ -d "$1" ]; then
  dir=$1
else
  dir=$(mktemp -d)
  trap 'rm -rf "$dir"' EXIT
  gh run download "$1" -R "$repo" -p 'report-*' -D "$dir"
  # Same engagement as the CI upload of that run, so the fallback never forks the history.
  export DEFECTDOJO_ENGAGEMENT=${DEFECTDOJO_ENGAGEMENT:-CI - $(gh run view "$1" -R "$repo" --json headBranch -q .headBranch)}
fi

rc=0
while IFS=$'\t' read -r scan_type title file; do
  case $scan_type in '' | '#'*) continue ;; esac
  path=$(find "$dir" -name "$file" -print -quit)
  "$here/upload_to_defectdojo.sh" "$scan_type" "$title" "${path:-$dir/$file}" || rc=1
done < "$here/reports.tsv"
exit $rc
