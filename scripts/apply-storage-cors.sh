#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUCKET="gs://wssmusicinteractions.firebasestorage.app"
PROJECT_ID="wssmusicinteractions"
CORS_FILE="$ROOT_DIR/storage-cors.json"

find_gcloud() {
  if command -v gcloud >/dev/null 2>&1; then
    command -v gcloud
    return
  fi
  for candidate in /opt/homebrew/bin/gcloud /usr/local/bin/gcloud; do
    if [[ -x "$candidate" ]]; then
      echo "$candidate"
      return
    fi
  done
  return 1
}

find_gsutil() {
  if command -v gsutil >/dev/null 2>&1; then
    command -v gsutil
    return
  fi
  for candidate in /opt/homebrew/bin/gsutil /usr/local/bin/gsutil; do
    if [[ -x "$candidate" ]]; then
      echo "$candidate"
      return
    fi
  done
  return 1
}

GCLOUD="$(find_gcloud)" || {
  echo "Google Cloud SDK not found."
  echo "Install it with: brew install --cask gcloud-cli"
  exit 1
}

GSUTIL="$(find_gsutil)" || {
  echo "gsutil not found (it ships with the Google Cloud SDK)."
  echo "Install it with: brew install --cask gcloud-cli"
  exit 1
}

if ! "$GCLOUD" auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
  echo "No active Google Cloud login."
  echo "Sign in with the same Google account you use for Firebase:"
  "$GCLOUD" auth login
fi

"$GCLOUD" config set project "$PROJECT_ID"
"$GSUTIL" cors set "$CORS_FILE" "$BUCKET"

echo ""
echo "Storage CORS applied to $BUCKET"
echo "Verify with: $GSUTIL cors get $BUCKET"
