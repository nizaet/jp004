# JP004 Mobile Buddy + Cloud Run (additive fork)

This branch **preserves the original jp004 project**. The original `server.py`, calculation logic, fee treatment, XIRR, transaction screens, pairing, and import/export are untouched. The only change to upstream `jp004.html` is three asset includes.

## Behavior
- Desktop, width >820px: original jp004 UI.
- Phone/Fold, width <=820px: Buddy v0.6 interface, animated 3D avatar, six KPIs (balance, invested, total equity, unrealized/realized P&L and XIRR), and ten best/worst active holdings by unrealized return.
- "Menu asli" opens the original transaction UI; mobile navigation keeps independent scroll positions.
- Prices use the upstream Flask/TradingView proxy. Third-party market data may fail or lag.
- **Data is still browser-local** (`localStorage`): Cloud Run does not synchronize transactions across devices. To migrate a personal journal, export JSON from the old origin, back up the new journal, and import JSON at the new origin.

## Deploy in an existing Google Cloud project
1. Open [Google Cloud Shell](https://console.cloud.google.com/) and select the project that already has billing.
2. `git clone https://github.com/nizaet/jp004.git && cd jp004`
3. If this change is still in a PR branch, run `git switch feat/mobile-buddy-cloudrun` after `git fetch origin`. If merged, stay on `main`.
4. `PROJECT="$(gcloud config get-value project)" REGION=asia-southeast2 bash deploy-cloudrun.sh`
5. Open the displayed Cloud Run URL. Desktop and mobile should show the appropriate UI.

The deploy script uses a separate service name `jp004-buddy` and refuses to overwrite an existing service. It publishes only the app, market-price API, and health endpoint. The `cloudrun_app.py` allowlist prevents accidentally serving source files, private exports, backup files, or future credentials under the repo root.

## Security / MCP implementation status
This is the **UI + Cloud Run deployment layer only**. No MCP read/write endpoint or cloud portfolio database is included yet. A safe ChatGPT transaction MCP requires owner authentication, Firestore/database migration, an idempotent preview/commit flow, audit history and private API access. Do not add unauthenticated transaction-write endpoints or commit portfolio exports to public GitHub.

## Checks
- Confirm desktop looks identical to the upstream original.
- Confirm 6 KPIs, 10 best and 10 worst, 3D avatar, stable tab navigation on mobile.
- `GET /api/health` should return JSON.
- Requests to `/server.py`, `/README.md`, and `/.env` should return 404.
- Export a journal backup before testing imports.
