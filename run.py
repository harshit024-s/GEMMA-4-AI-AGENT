#!/usr/bin/env python3
"""Launcher for the Gemma 4 AI Agent.

Starts the FastAPI server which serves both the API and the frontend.
"""

import sys
from pathlib import Path

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Safe console output on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

import uvicorn
from backend.config import HOST, PORT


def main() -> None:
    display_host = "localhost" if HOST in ("0.0.0.0", "127.0.0.1") else HOST
    print(
        "\n"
        "  ==========================================\n"
        "             Gemma 4 AI Agent               \n"
        "  ==========================================\n"
        f"    Bind:    http://{HOST}:{PORT}\n"
        f"    Open:    http://{display_host}:{PORT}\n"
        f"    Docs:    http://{display_host}:{PORT}/docs\n"
        "  ==========================================\n"
    )

    uvicorn.run(
        "backend.main:app",
        host=HOST,
        port=PORT,
        reload=True,
        app_dir=str(PROJECT_ROOT),
        log_level="info",
    )


if __name__ == "__main__":
    main()
