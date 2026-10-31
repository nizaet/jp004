"""Private Firestore and MCP API for JP004 Buddy.

Every route is behind Cloud Run IAP and verifies Google's signed IAP assertion
again in-process. Firestore access uses the Cloud Run service identity.
"""
import hashlib
import json
import os
import re
import time
import uuid
from datetime import datetime, timezone

from flask import Flask, jsonify, request
from google.auth.transport import requests as google_requests
from google.cloud import firestore
from google.oauth2 import id_token

PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "jp-porto")
DATABASE_ID = os.environ.get("FIRESTORE_DATABASE", "jp004-buddy")
IAP_AUDIENCE = os.environ.get(
    "IAP_AUDIENCE",
    "/projects/9331929364/locations/asia-southeast2/services/jp004-buddy",
)
IAP_CERTS_URL = "https://www.gstatic.com/iap/verify/public_key"
MAX_BODY_BYTES = 64 * 1024
MAX_TRANSACTIONS = 1000
PROPOSAL_TTL_SECONDS = 15 * 60
ALLOWED_ACTIONS = {
    "BUY", "SELL", "DEPOSIT", "WITHDRAW", "DIVIDEND", "FEE",
    "WARRANT", "RIGHT", "SPLIT", "MERGE", "TRANSFER_IN", "TRANSFER_OUT",
}

api = Flask(__name__)
_db = None


def db():
    global _db
    if _db is None:
        _db = firestore.Client(project=PROJECT_ID, database=DATABASE_ID)
    return _db


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def _verified_identity():
    assertion = request.headers.get("x-goog-iap-jwt-assertion", "")
    if not assertion:
        return None
    try:
        claims = id_token.verify_token(
            assertion, google_requests.Request(), audience=IAP_AUDIENCE,
            certs_url=IAP_CERTS_URL,
        )
    except Exception:
        return None
    if claims.get("iss") != "https://cloud.google.com/iap":
        return None
    subject = claims.get("sub")
    if not isinstance(subject, str) or not subject or len(subject) > 256:
        return None
    return {"sub": subject, "email": claims.get("email", "")}


@api.before_request
def require_iap():
    if request.content_length is not None and request.content_length > MAX_BODY_BYTES:
        return jsonify(error="request_too_large"), 413
    identity = _verified_identity()
    if not identity:
        return jsonify(error="unauthorized"), 401
    request.identity = identity


def _uid():
    # Stable, non-PII document key. Email addresses are never used as Firestore paths.
    return hashlib.sha256(request.identity["sub"].encode("utf-8")).hexdigest()


def _user_ref():
    return db().collection("users").document(_uid())


def _json_body():
    body = request.get_json(silent=True)
    return body if isinstance(body, dict) else None


def _canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False,
                      allow_nan=False)


def _validate_transaction(value):
    if not isinstance(value, dict) or len(_canonical(value).encode("utf-8")) > 32_000:
        return None, "transaction must be an object under 32 KB"
    action = str(value.get("action") or "").strip().upper()
    date = str(value.get("date") or "").strip()
    if action not in ALLOWED_ACTIONS:
        return None, "unsupported transaction action"
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
        return None, "date must use YYYY-MM-DD"
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        return None, "date is invalid"
    result = dict(value)
    result["action"] = action
    result["date"] = date
    # Reject non-JSON values and NaN before data reaches Firestore.
    try:
        _canonical(result)
    except (TypeError, ValueError):
        return None, "transaction contains unsupported values"
    return result, None


def _digest(value):
    return hashlib.sha256(_canonical(value).encode("utf-8")).hexdigest()


def _proposal_ref(proposal_id):
    return _user_ref().collection("proposals").document(proposal_id)


def _save_proposal(proposal):
    """Persist one immutable preview, enforcing one proposal per idempotency key."""
    idem_ref = _user_ref().collection("idempotency").document(proposal["idempotency_key"])
    proposal_id = str(uuid.uuid4())
    proposal_ref = _proposal_ref(proposal_id)
    request_hash = _digest({k: proposal[k] for k in ("operation", "transaction_id", "before_digest", "after_digest")})
    tx = db().transaction()

    @firestore.transactional
    def save(transaction):
        prior = idem_ref.get(transaction=transaction)
        if prior.exists:
            old = prior.to_dict() or {}
            if old.get("request_hash") != request_hash:
                raise ValueError("idempotency_key_reused_with_different_request")
            existing_ref = _proposal_ref(old["proposal_id"])
            existing = existing_ref.get(transaction=transaction)
            return old["proposal_id"], existing.to_dict() or {}, True
        transaction.create(proposal_ref, proposal)
        transaction.create(idem_ref, {"proposal_id": proposal_id, "request_hash": request_hash,
                                      "created_at": now_iso()})
        return proposal_id, proposal, False

    return save(tx)


def _transactions_ref():
    return _user_ref().collection("transactions")


def _public_transaction(doc):
    data = doc.to_dict() or {}
    data["id"] = doc.id
    return data


@api.get("/api/portfolio/transactions")
def list_transactions():
    limit = min(max(request.args.get("limit", 500, type=int), 1), MAX_TRANSACTIONS)
    docs = _transactions_ref().order_by("date", direction=firestore.Query.DESCENDING).limit(limit).stream()
    rows = [_public_transaction(doc) for doc in docs]
    return jsonify({"transactions": rows, "count": len(rows), "source": "JP004 Buddy Firestore"})


@api.post("/api/portfolio/preview")
def preview_transaction():
    body = _json_body()
    if not body:
        return jsonify(error="invalid_json"), 400
    operation = body.get("operation")
    idem = str(body.get("idempotency_key") or "")
    if operation not in {"create", "update", "delete"}:
        return jsonify(error="unsupported_operation"), 400
    try:
        uuid.UUID(idem)
    except (ValueError, TypeError, AttributeError):
        return jsonify(error="idempotency_key_must_be_uuid"), 400

    ref = _transactions_ref()
    transaction_id = str(body.get("transaction_id") or "")
    before = None
    if operation in {"update", "delete"}:
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", transaction_id):
            return jsonify(error="invalid_transaction_id"), 400
        snap = ref.document(transaction_id).get()
        if not snap.exists:
            return jsonify(error="transaction_not_found"), 404
        before = snap.to_dict() or {}

    after = None
    if operation in {"create", "update"}:
        after, error = _validate_transaction(body.get("transaction"))
        if error:
            return jsonify(error=error), 400

    proposal_id = str(uuid.uuid4())
    proposal = {
        "operation": operation,
        "transaction_id": transaction_id if operation != "create" else str(uuid.uuid4()),
        "before": before,
        "before_digest": _digest(before) if before is not None else None,
        "after": after,
        "after_digest": _digest(after) if after is not None else None,
        "idempotency_key": idem,
        "status": "pending",
        "created_at": now_iso(),
        "expires_at_epoch": int(time.time()) + PROPOSAL_TTL_SECONDS,
    }
    try:
        proposal_id, proposal, duplicate = _save_proposal(proposal)
    except ValueError as exc:
        return jsonify(error=str(exc)), 409
    return jsonify({
        "proposal_id": proposal_id, "status": "pending",
        "expires_in_seconds": PROPOSAL_TTL_SECONDS,
        "preview": {"operation": operation, "transaction_id": proposal["transaction_id"],
                    "before": before, "after": after,
                    "confirmation_required": True},
        "audit": "A proposal record was created; no transaction changed.",
        "idempotent_replay": duplicate,
    }), 201


@api.post("/api/portfolio/confirm")
def confirm_transaction():
    body = _json_body()
    if not body:
        return jsonify(error="invalid_json"), 400
    proposal_id = str(body.get("proposal_id") or "")
    idem = str(body.get("idempotency_key") or "")
    try:
        uuid.UUID(proposal_id)
        uuid.UUID(idem)
    except (ValueError, TypeError, AttributeError):
        return jsonify(error="proposal_and_idempotency_keys_must_be_uuid"), 400

    proposal_ref = _proposal_ref(proposal_id)
    trans = _transactions_ref()
    audit_ref = _user_ref().collection("audit").document(proposal_id)
    db_trans = db().transaction()

    @firestore.transactional
    def commit(transaction):
        proposal_snap = proposal_ref.get(transaction=transaction)
        if not proposal_snap.exists:
            raise LookupError("proposal_not_found")
        proposal = proposal_snap.to_dict() or {}
        if proposal.get("idempotency_key") != idem:
            raise PermissionError("idempotency_key_mismatch")
        if proposal.get("status") == "committed":
            return proposal.get("result") or {"status": "committed", "idempotent_replay": True}
        if proposal.get("status") != "pending":
            raise ValueError("proposal_not_pending")
        if int(proposal.get("expires_at_epoch", 0)) < int(time.time()):
            raise TimeoutError("proposal_expired")

        operation = proposal["operation"]
        target_ref = trans.document(proposal["transaction_id"])
        existing = target_ref.get(transaction=transaction)
        if operation == "create":
            if existing.exists:
                raise FileExistsError("transaction_id_exists")
            transaction.create(target_ref, {**proposal["after"], "created_at": now_iso(), "updated_at": now_iso()})
            outcome = "created"
        else:
            if not existing.exists:
                raise LookupError("transaction_not_found")
            current = existing.to_dict() or {}
            if _digest(current) != proposal.get("before_digest"):
                raise RuntimeError("transaction_changed_since_preview")
            if operation == "update":
                transaction.set(target_ref, {**proposal["after"], "created_at": current.get("created_at", now_iso()), "updated_at": now_iso()})
                outcome = "updated"
            else:
                transaction.delete(target_ref)
                outcome = "deleted"

        result = {"status": "committed", "operation": outcome,
                  "transaction_id": proposal["transaction_id"], "idempotent_replay": False}
        audit = {
            "proposal_id": proposal_id, "operation": outcome,
            "transaction_id": proposal["transaction_id"],
            "actor_hash": _uid(), "at": now_iso(),
            "before_digest": proposal.get("before_digest"),
            "after_digest": proposal.get("after_digest"),
            "idempotency_key": idem,
        }
        transaction.create(audit_ref, audit)
        transaction.update(proposal_ref, {"status": "committed", "committed_at": now_iso(),
                                          "result": result})
        return result

    try:
        result = commit(db_trans)
    except LookupError as exc:
        return jsonify(error=str(exc)), 404
    except PermissionError as exc:
        return jsonify(error=str(exc)), 403
    except TimeoutError as exc:
        return jsonify(error=str(exc)), 410
    except FileExistsError as exc:
        return jsonify(error=str(exc)), 409
    except (RuntimeError, ValueError) as exc:
        return jsonify(error=str(exc)), 409
    return jsonify(result)


@api.get("/api/portfolio/insights")
def portfolio_insights():
    docs = _transactions_ref().limit(MAX_TRANSACTIONS).stream()
    counts = {}
    ticker_counts = {}
    for doc in docs:
        row = doc.to_dict() or {}
        action = str(row.get("action") or "UNKNOWN").upper()
        counts[action] = counts.get(action, 0) + 1
        ticker = str(row.get("ticker") or "").upper()
        if ticker:
            ticker_counts[ticker] = ticker_counts.get(ticker, 0) + 1
    return jsonify({"source": "JP004 Buddy Firestore", "transactions_reviewed": sum(counts.values()),
                    "count_by_action": counts,
                    "most_traded_tickers": sorted(ticker_counts.items(), key=lambda x: (-x[1], x[0]))[:10],
                    "scope_note": "Activity counts only; no valuation, return, or investment recommendation."})


TOOLS = [
    {"name": "portfolio_list_transactions", "description": "Read the authenticated user's JP004 Buddy transactions from private Firestore.",
     "inputSchema": {"type": "object", "properties": {"limit": {"type": "integer", "minimum": 1, "maximum": 1000}}, "additionalProperties": False}},
    {"name": "portfolio_insights", "description": "Summarize transaction activity counts for the authenticated user's portfolio; this is not valuation or advice.",
     "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False}},
    {"name": "portfolio_preview_transaction", "description": "Create a no-write preview for a create, update, or delete. Returns a proposal ID; no transaction changes until separately confirmed.",
     "inputSchema": {"type": "object", "required": ["operation", "idempotency_key"], "properties": {
         "operation": {"type": "string", "enum": ["create", "update", "delete"]},
         "transaction_id": {"type": "string"}, "transaction": {"type": "object"},
         "idempotency_key": {"type": "string", "format": "uuid"}}, "additionalProperties": False}},
    {"name": "portfolio_confirm_transaction", "description": "Commit one previously previewed transaction change. Requires the exact proposal ID and idempotency key from the preview.",
     "inputSchema": {"type": "object", "required": ["proposal_id", "idempotency_key"], "properties": {
         "proposal_id": {"type": "string", "format": "uuid"}, "idempotency_key": {"type": "string", "format": "uuid"}}, "additionalProperties": False}},
]


def _tool_result(value, is_error=False):
    return {"content": [{"type": "text", "text": json.dumps(value, ensure_ascii=False)}], "isError": is_error}


def _mcp_error(req_id, code, message):
    return {"jsonrpc": "2.0", "id": req_id, "error": {"code": code, "message": message}}


@api.route("/mcp", methods=["GET", "POST", "DELETE"])
def mcp_endpoint():
    if request.method != "POST":
        return jsonify(error="streamable_http_post_required"), 405, {"Allow": "POST"}
    body = request.get_json(silent=True)
    if not isinstance(body, dict) or body.get("jsonrpc") != "2.0":
        return jsonify(_mcp_error(None, -32600, "Invalid Request")), 400
    req_id, method, params = body.get("id"), body.get("method"), body.get("params") or {}
    if req_id is None:  # JSON-RPC notification
        return "", 202
    if method == "initialize":
        result = {"protocolVersion": "2025-03-26", "capabilities": {"tools": {"listChanged": False}},
                  "serverInfo": {"name": "jp004-buddy", "version": "0.1.0"}}
    elif method == "notifications/initialized":
        return "", 202
    elif method == "ping":
        result = {}
    elif method == "tools/list":
        result = {"tools": TOOLS}
    elif method == "tools/call":
        name, args = params.get("name"), params.get("arguments") or {}
        if not isinstance(args, dict):
            return jsonify(_mcp_error(req_id, -32602, "Invalid params")), 200
        # Dispatch directly while retaining the authenticated IAP request context.
        try:
            if name == "portfolio_list_transactions":
                limit = min(max(int(args.get("limit", 500)), 1), MAX_TRANSACTIONS)
                value = [_public_transaction(d) for d in _transactions_ref().order_by("date", direction=firestore.Query.DESCENDING).limit(limit).stream()]
            elif name == "portfolio_insights":
                docs = _transactions_ref().limit(MAX_TRANSACTIONS).stream(); counts = {}; tickers = {}
                for doc in docs:
                    row = doc.to_dict() or {}; action = str(row.get("action") or "UNKNOWN").upper(); counts[action] = counts.get(action, 0)+1
                    ticker = str(row.get("ticker") or "").upper()
                    if ticker: tickers[ticker] = tickers.get(ticker, 0)+1
                value = {"transactions_reviewed": sum(counts.values()), "count_by_action": counts,
                         "most_traded_tickers": sorted(tickers.items(), key=lambda x: (-x[1], x[0]))[:10],
                         "scope_note": "Activity counts only; no valuation, return, or investment recommendation."}
            elif name == "portfolio_preview_transaction":
                # MCP clients use the same API implementation after this direct call.
                value = _mcp_preview(args)
            elif name == "portfolio_confirm_transaction":
                value = _mcp_confirm(args)
            else:
                return jsonify(_mcp_error(req_id, -32602, "Unknown tool")), 200
            result = _tool_result(value)
        except Exception as exc:
            result = _tool_result({"error": str(exc)}, True)
    else:
        return jsonify(_mcp_error(req_id, -32601, "Method not found")), 200
    return jsonify({"jsonrpc": "2.0", "id": req_id, "result": result}), 200, {"Mcp-Protocol-Version": "2025-03-26"}


def _mcp_preview(args):
    operation = args.get("operation"); idem = str(args.get("idempotency_key") or "")
    try: uuid.UUID(idem)
    except Exception: raise ValueError("idempotency_key_must_be_uuid")
    if operation not in {"create", "update", "delete"}: raise ValueError("unsupported_operation")
    before = None; transaction_id = str(args.get("transaction_id") or "")
    if operation in {"update", "delete"}:
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", transaction_id): raise ValueError("invalid_transaction_id")
        snap = _transactions_ref().document(transaction_id).get()
        if not snap.exists: raise LookupError("transaction_not_found")
        before = snap.to_dict() or {}
    after = None
    if operation in {"create", "update"}:
        after, err = _validate_transaction(args.get("transaction"))
        if err: raise ValueError(err)
    proposal_id = str(uuid.uuid4())
    proposal = {"operation": operation, "transaction_id": transaction_id or str(uuid.uuid4()),
                "before": before, "before_digest": _digest(before) if before is not None else None,
                "after": after, "after_digest": _digest(after) if after is not None else None,
                "idempotency_key": idem, "status": "pending", "created_at": now_iso(),
                "expires_at_epoch": int(time.time())+PROPOSAL_TTL_SECONDS}
    proposal_id, proposal, duplicate = _save_proposal(proposal)
    return {"proposal_id": proposal_id, "status": "pending", "expires_in_seconds": PROPOSAL_TTL_SECONDS,
            "preview": {"operation": operation, "transaction_id": proposal["transaction_id"],
                        "before": before, "after": after, "confirmation_required": True},
            "idempotent_replay": duplicate}


def _mcp_confirm(args):
    # Use the same HTTP commit function by reusing its transaction implementation through
    # a small request context and returning its JSON body; identity remains IAP-derived.
    proposal_id = str(args.get("proposal_id") or ""); idem = str(args.get("idempotency_key") or "")
    try: uuid.UUID(proposal_id); uuid.UUID(idem)
    except Exception: raise ValueError("proposal_and_idempotency_keys_must_be_uuid")
    proposal_ref = _proposal_ref(proposal_id); transaction_ref = _transactions_ref(); audit_ref = _user_ref().collection("audit").document(proposal_id)
    trans = db().transaction()
    @firestore.transactional
    def commit(tx):
        snap = proposal_ref.get(transaction=tx)
        if not snap.exists: raise LookupError("proposal_not_found")
        proposal = snap.to_dict() or {}
        if proposal.get("idempotency_key") != idem: raise PermissionError("idempotency_key_mismatch")
        if proposal.get("status") == "committed": return proposal.get("result")
        if proposal.get("status") != "pending": raise ValueError("proposal_not_pending")
        if int(proposal.get("expires_at_epoch", 0)) < int(time.time()): raise TimeoutError("proposal_expired")
        target = transaction_ref.document(proposal["transaction_id"]); old = target.get(transaction=tx)
        op = proposal["operation"]
        if op == "create":
            if old.exists: raise FileExistsError("transaction_id_exists")
            tx.create(target, {**proposal["after"], "created_at": now_iso(), "updated_at": now_iso()}); label="created"
        else:
            if not old.exists: raise LookupError("transaction_not_found")
            current = old.to_dict() or {}
            if _digest(current) != proposal.get("before_digest"): raise RuntimeError("transaction_changed_since_preview")
            if op == "update": tx.set(target, {**proposal["after"], "created_at": current.get("created_at", now_iso()), "updated_at": now_iso()}); label="updated"
            else: tx.delete(target); label="deleted"
        result = {"status":"committed", "operation":label, "transaction_id":proposal["transaction_id"], "idempotent_replay":False}
        tx.create(audit_ref, {"proposal_id":proposal_id, "operation":label, "transaction_id":proposal["transaction_id"],
                  "actor_hash":_uid(), "at":now_iso(), "before_digest":proposal.get("before_digest"),
                  "after_digest":proposal.get("after_digest"), "idempotency_key":idem})
        tx.update(proposal_ref, {"status":"committed", "committed_at":now_iso(), "result":result})
        return result
    return commit(trans)
