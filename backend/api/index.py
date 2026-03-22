# Vercel ASGI entry point.
# Vercel discovers this file and wraps it with its Python runtime.
# All requests are routed here via vercel.json.
from main import app  # noqa: F401 — Vercel imports `app` from this module
