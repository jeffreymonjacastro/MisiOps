#!/usr/bin/env bash
# Security gate (FR-012). Blocks only when ENFORCE=true (pull requests into main, pushes to main);
# otherwise warns, because merges into develop are report-only under constitution exemption EX-001.
# Usage: gate.sh <tool> <blocking-finding-count>
set -euo pipefail

if [ $# -ne 2 ]; then
  echo "usage: $0 <tool> <count>" >&2
  exit 2
fi
tool=$1 count=$2
mode=report-only
[ "${ENFORCE:-false}" = true ] && mode=blocking
[ -n "${GITHUB_STEP_SUMMARY:-}" ] && echo "- **$tool**: $count blocking findings ($mode)" >> "$GITHUB_STEP_SUMMARY"

if [ "$count" -eq 0 ]; then
  echo "$tool: no blocking findings"
elif [ "$mode" = blocking ]; then
  echo "::error::$tool: $count blocking findings"
  exit 1
else
  echo "::warning::$tool: $count findings would block a merge into main (report-only, constitution EX-001)"
fi
