#!/usr/bin/env bash
set -euo pipefail

# Deliberately fixed to a new, private service. Do not reuse SPPG services.
SERVICE="jp004-buddy"
REGION="${REGION:-asia-southeast2}"
PROJECT="${PROJECT:-$(gcloud config get-value project 2>/dev/null)}"

if [[ -z "$PROJECT" || "$PROJECT" == "(unset)" ]]; then
  echo 'ERROR: Pilih Google Cloud project yang benar terlebih dahulu.' >&2
  exit 1
fi
for f in server.py jp004.html ref_table.csv requirements.txt Dockerfile cloudrun_app.py mobile-ui.css mobile-ui.js avatar3d.js; do
  [[ -f "$f" ]] || { echo "ERROR: file wajib tidak ada: $f" >&2; exit 1; }
done
if gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" >/dev/null 2>&1; then
  echo "ERROR: service $SERVICE sudah ada. Script tidak menimpa service yang ada." >&2
  exit 1
fi

# Cloud Run IAM authentication is mandatory. The portfolio remains in localStorage;
# no transaction or portfolio write API is exposed by this UI-only release.
gcloud run deploy "$SERVICE" \
  --project "$PROJECT" \
  --region "$REGION" \
  --source . \
  --no-allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 1

gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format='value(status.url)'
