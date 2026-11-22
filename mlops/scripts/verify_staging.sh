#!/usr/bin/env bash
set -euo pipefail
manifest=backend/forecast_release/manifest.json
version=$(jq -er .version "$manifest")
hash=$(jq -er .model_sha256 "$manifest")
manifest_hash=$(sha256sum "$manifest" | cut -d' ' -f1)
root=$(mktemp -d)
trap 'rm -rf "$root"' EXIT
name="forecast-staging-$version"
# Only accept successful push runs of the repository's DevSecOps workflow on develop.
ids=$(gh run list --workflow devsecops.yml --branch develop --event push --status success \
  --limit 30 --json databaseId --jq '.[].databaseId')
for id in $ids; do
  artifact=$(gh api "repos/$GITHUB_REPOSITORY/actions/runs/$id/artifacts?name=$name" \
    --jq '.artifacts[] | select(.expired == false) | .name')
  if [[ "$artifact" != "$name" ]]; then continue; fi
  gh run download "$id" --name "$name" --dir "$root/$id"
  if ! jq -e --arg version "$version" --arg hash "$hash" --arg manifest "$manifest_hash" \
    '.environment == "dev" and .version == $version and .model_sha256 == $hash and .manifest_sha256 == $manifest' \
    "$root/$id/forecast-release.json" >/dev/null; then
    continue
  fi
  printf 'Staging run %s verified model %s\n' "$id" "$version" >> "$GITHUB_STEP_SUMMARY"
  exit 0
done
echo "No successful staging receipt for forecast $version. Deploy it to dev first." >&2
exit 1
