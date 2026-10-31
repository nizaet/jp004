"""Cloud Run WSGI entrypoint with allowlisted private portfolio APIs."""
from server import app as jp004_app
from cloudrun_backend import api as private_api

_ALLOWED_GET = {
    "/", "/api/health", "/api/price",
    "/mobile-ui.css", "/mobile-ui.js", "/avatar3d.js",
}
_ALLOWED_POST = {"/api/prices"}
_PRIVATE_PATHS = {
    "/api/portfolio/transactions", "/api/portfolio/insights",
    "/api/portfolio/preview", "/api/portfolio/confirm", "/mcp",
}


def application(environ, start_response):
    path = environ.get("PATH_INFO", "")
    method = environ.get("REQUEST_METHOD", "GET").upper()
    if path in _PRIVATE_PATHS:
        return private_api(environ, start_response)
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
