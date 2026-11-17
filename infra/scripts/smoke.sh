#!/usr/bin/env bash
# Post-deployment verification (FR-017, NFR-009, SC-009): the public address serves the web app and the API,
# and both answer within 2 s at p95 over 20 sequential requests. Exit 0 when every check passes, 1 otherwise.
# usage: smoke.sh <public-url>
set -euo pipefail

url=${1:-}
if [ -z "$url" ]; then echo "usage: $0 <public-url>" >&2; exit 2; fi
url=${url%/}
samples=20
p95_limit=2.0
body=$(mktemp); trap 'rm -f "$body"' EXIT

fail() { echo "FAIL - $*"; exit 1; }
# Prints "<status> <seconds>"; a transport error (DNS, TLS, timeout) counts as status 000.
probe() { curl -s -o "$body" -w '%{http_code} %{time_total}' --max-time 10 "$1" || echo "000 10"; }

content_check() { # path expected-substring
  local result status
  result=$(probe "$url$1"); status=${result%% *}
  [ "$status" = "200" ] || fail "GET $1 returned HTTP $status (expected 200)"
  grep -q -- "$2" "$body" || fail "GET $1 body does not contain $2"
  echo "ok   - GET $1 is 200 and contains $2"
}
latency_check() { # path
  local times=() result status
  for _ in $(seq "$samples"); do
    result=$(probe "$url$1"); status=${result%% *}
    [ "$status" = "200" ] || fail "GET $1 returned HTTP $status during sampling"
    times+=("${result#* }")
  done
  [ "${#times[@]}" -eq "$samples" ] || fail "collected ${#times[@]} samples for $1 (expected $samples)"
  local p95
  p95=$(printf '%s\n' "${times[@]}" | sort -g | sed -n "$((samples * 95 / 100))p")
  if awk -v p="$p95" -v l="$p95_limit" 'BEGIN { exit !(p > l) }'; then
    fail "GET $1 p95 ${p95}s over $samples requests exceeds ${p95_limit}s"
  fi
  echo "ok   - GET $1 p95 ${p95}s over $samples requests"
}

content_check / MisiOps
content_check /openapi.json '"openapi"'
latency_check /
latency_check /openapi.json
echo "smoke: all checks passed for $url"
