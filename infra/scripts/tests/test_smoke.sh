#!/usr/bin/env bash
# Tests for infra/scripts/smoke.sh (FR-017, NFR-009). curl is stubbed; scenarios come from STUB_MODE.
set -uo pipefail

root=$(cd "$(dirname "$0")/../.." && pwd)
smoke="$root/scripts/smoke.sh"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/bin"

# curl stub: understands `-s -o <file> -w <fmt> <url>`; writes a body and prints "<status> <time>".
cat > "$work/bin/curl" <<'STUB'
#!/usr/bin/env bash
out=; url=
while [ $# -gt 0 ]; do
  case $1 in
    -o) out=$2; shift ;;
    -w|--max-time) shift ;;
    -s) ;;
    *) url=$1 ;;
  esac
  shift
done
echo "$url" >> "$CALLS"
status=200; time=0.123; body='<html><title>MisiOps</title></html>'
case $url in *openapi.json) body='{"openapi":"3.1.0"}' ;; esac
case $STUB_MODE in
  api-500) [[ $url == *openapi.json ]] && status=500 ;;
  no-brand) body='<html>nothing</html>' ;;
  slow-once) [[ $url == */ ]] && [ "$(grep -c '/$' "$CALLS")" -eq 5 ] && time=3.5 ;;
  slow-few) if [[ $url == */ ]]; then n=$(grep -c '/$' "$CALLS"); [ "$n" -ge 5 ] && [ "$n" -le 6 ] && time=3.5; fi ;;
  curl-fail) exit 7 ;;
esac
[ -n "$out" ] && printf '%s' "$body" > "$out"
printf '%s %s' "$status" "$time"
STUB
chmod +x "$work/bin/curl"
export PATH="$work/bin:$PATH" CALLS="$work/calls"

fail=0
check() { if eval "$2"; then echo "ok   - $1"; else echo "FAIL - $1 (exit=$code) $out"; fail=1; fi; }
run() { : > "$CALLS"; out=$(STUB_MODE=$1 "$smoke" "${2-https://example.test}" 2>&1); code=$?; }

run none
check "healthy site exits 0" '[ $code -eq 0 ] && [[ $out == *"p95"* ]]'
check "20 samples per path plus the two content checks" '[ "$(grep -c "/$" "$CALLS")" -eq 21 ] && [ "$(grep -c "openapi.json$" "$CALLS")" -eq 21 ]'

run api-500
check "openapi.json returning 500 exits 1 and names the check" '[ $code -eq 1 ] && [[ $out == *"FAIL"*"openapi.json"* ]]'

run no-brand
check "home page without MisiOps exits 1" '[ $code -eq 1 ] && [[ $out == *"FAIL"*"MisiOps"* ]]'

run slow-once
check "one slow sample out of 20 keeps p95 under 2 s" '[ $code -eq 0 ]'

run slow-few
check "two slow samples push p95 over 2 s and exit 1" '[ $code -eq 1 ] && [[ $out == *"p95"* ]]'

run curl-fail
check "unreachable site exits 1" '[ $code -eq 1 ]'

run none ""
check "missing URL argument exits 2 with usage" '[ $code -eq 2 ] && [[ $out == *usage* ]]'

exit $fail
