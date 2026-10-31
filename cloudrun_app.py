"""Public Cloud Run entrypoint that keeps the original jp004 server.py intact.

Only the HTML UI, Buddy assets, and existing price/health APIs are public.
Browser transactions remain in localStorage; no remote portfolio write APIs.
"""
from server import app as jp004_app

_ALLOWED_GET = {
    "/", "/api/health", "/api/price",
    "/mobile-ui.css", "/mobile-ui.js", "/avatar3d.js",
}
_ALLOWED_POST = {"/api/prices"}


def application(environ, start_response):
    path = environ.get("PATH_INFO", "")
    method = environ.get("REQUEST_METHOD", "GET").upper()
    if (method in ("GET", "HEAD", "OPTIONS") and path in _ALLOWED_GET) or (
        method in ("POST", "OPTIONS") and path in _ALLOWED_POST
    ):
        return jp004_app(environ, start_response)

    body = b"Not found"
    start_response("404 Not Found", [
        ("Content-Type", "text/plain; charset=utf-8"),
        ("Content-Length", str(len(body))),
        ("Cache-Control", "no-store"),
    ])
    return [body]
