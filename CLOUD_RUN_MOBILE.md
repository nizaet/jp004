# JP004 Mobile Buddy + Cloud Run (additive fork)

The original jp004 project is preserved. The original `server.py`, calculations, fee treatment, XIRR, transaction screens, pairing, and import/export remain unchanged. The original `jp004.html` only adds three mobile asset references.

## Behavior
- Desktop, width >820px: original jp004 UI.
- Phone/Fold, width <=820px: Buddy v0.6 interface, animated 3D avatar, six KPIs (balance, invested, total equity, unrealized/realized P&L and XIRR), and ten best/worst active holdings by unrealized return.
- "Menu asli" opens the original transaction UI; mobile navigation keeps independent scroll positions.
- Prices use the upstream Flask/TradingView proxy. Third-party market data may fail or lag.
- Portfolio transactions remain in browser `localStorage`. This release has no cloud portfolio database, sync, or MCP transaction API.

## Deploy privately in an existing Google Cloud project
1. Open [Google Cloud Console](https://console.cloud.google.com/) and select the project that already has billing.
2. Clone `https://github.com/nizaet/jp004.git` and enter the repository.
3. Use the `fix/private-cloudrun-deploy` branch until its private-auth deployment fix is merged.
4. Run `PROJECT="$(gcloud config get-value project)" REGION=asia-southeast2 bash deploy-cloudrun.sh` from Cloud Shell.
5. The script creates only the new service `jp004-buddy`; it refuses to overwrite an existing service and requires Cloud Run IAM authentication. It does not grant public access. Grant Cloud Run Invoker only to the Google accounts that should access the service.
6. Copy the returned service URL and verify it while signed in as an authorized invoker.

The WSGI allowlist publishes only the app, Buddy assets, and existing market-price/health endpoints. Source files, export files, backups, and credentials are not served. Cloud Run IAM authentication applies to the whole service, including the UI and these endpoints.

## Database and MCP status
Cloud portfolio storage and MCP tools are not implemented in this branch. Do not upload personal portfolio exports to GitHub or expose transaction data publicly. A later private data layer must add owner authentication, preview/confirm writes, idempotency, and audit history before enabling transaction access.

## Checks after deployment
- Confirm a signed-out request is rejected and an authorized user can open the app.
- Confirm desktop looks like the upstream original.
- Confirm six KPIs, ten best and ten worst holdings, the 3D avatar, and stable tab navigation on mobile.
- Confirm `/api/health` works only after authentication.
- Confirm requests to `/server.py`, `/README.md`, and `/.env` return 404 after authentication.
- Export a journal backup before testing imports.
