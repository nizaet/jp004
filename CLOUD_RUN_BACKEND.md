# JP004 Buddy private data API and MCP

The Cloud Run service `jp004-buddy` has a private portfolio API and a stateless
MCP Streamable HTTP endpoint at `/mcp`. Cloud Run IAP must stay enabled. Each
backend request verifies `x-goog-iap-jwt-assertion` against the service audience;
unsigned identity headers are not used. Firestore user documents are partitioned
by a SHA-256 hash of the IAP `sub` claim.

## Firestore

- Database: `jp004-buddy`, Firestore Standard, Native mode, Jakarta
  (`asia-southeast2`), with restrictive client security rules.
- Runtime identity: `jp004-buddy-runtime@jp-porto.iam.gserviceaccount.com`.
- The runtime identity needs `roles/datastore.user` to read and write Firestore
  documents. Do not create or upload a service-account key; Cloud Run uses its
  attached identity through Application Default Credentials.
- Collections are private under `users/{subject_hash}`: `transactions`,
  `proposals`, `idempotency`, and `audit`.

## HTTP API

- `GET /api/portfolio/transactions?limit=500` reads the authenticated user's
  journal.
- `POST /api/portfolio/preview` accepts `create`, `update`, or `delete`, plus a
  UUID `idempotency_key`. It creates an expiring proposal and does not change a
  transaction.
- `POST /api/portfolio/confirm` accepts the proposal ID and the same idempotency
  key. It commits once, rejects stale previews, and records an audit event in
  the same Firestore transaction.
- `GET /api/portfolio/insights` returns activity counts only; it is not a
  valuation, return calculation, or investment recommendation.

The existing browser journal remains in local storage. No data is uploaded
automatically. A future UI sync must show the data and ask the user to confirm
before sending it to Firestore.

## MCP

The `/mcp` endpoint implements MCP protocol `2025-03-26` over JSON Streamable
HTTP and exposes `portfolio_list_transactions`, `portfolio_insights`,
`portfolio_preview_transaction`, and `portfolio_confirm_transaction`. The same
IAP identity and private Firestore boundary apply to MCP calls. The endpoint
does not itself provide an OAuth authorization server. A client must already be
able to access the IAP-protected Cloud Run service; ChatGPT Android integration
has not been verified.

## Market data and scheduler

Market prices continue to come from the existing TradingView proxy and should
be treated as third-party data. This backend does not add fundamentals, news
feeds, or a daily scheduler. Add those only with named sources and clear source
timestamps; do not infer unsupported coverage from the portfolio MCP tools.
