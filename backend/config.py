"""Configuration for the Gemma 4 AI Agent."""

import os
from pathlib import Path
from dotenv import load_dotenv

# Search for .env in:
# 1) workspace root (parent of gemma4-agent/)
# 2) gemma4-agent directory (parent of backend/)
# 3) current working directory
PROJECT_DIR = Path(__file__).resolve().parent.parent
WORKSPACE_DIR = PROJECT_DIR.parent

loaded_any = False
if (WORKSPACE_DIR / ".env").exists():
    load_dotenv(WORKSPACE_DIR / ".env", override=True)
    loaded_any = True
if (PROJECT_DIR / ".env").exists():
    load_dotenv(PROJECT_DIR / ".env", override=True)
    loaded_any = True
if not loaded_any:
    load_dotenv(override=True)

# ── API Settings ──────────────────────────────────────────────────────────────
GEMINI_API_KEY: str = (
    os.getenv("GEMINI_API_KEY", "").strip()
    or os.getenv("GOOGLE_API_KEY", "").strip()
)
MODEL_NAME: str = os.getenv("MODEL_NAME", "gemma-4-26b-a4b-it").strip()

# Vertex AI / Endpoint Settings ("auto", "true", or "false")
USE_VERTEXAI: str = os.getenv("USE_VERTEXAI", os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "auto")).strip().lower()
GOOGLE_CLOUD_PROJECT: str = os.getenv("GOOGLE_CLOUD_PROJECT", "").strip()
GOOGLE_CLOUD_LOCATION: str = os.getenv("GOOGLE_CLOUD_LOCATION", "").strip()

# ── Server Settings ──────────────────────────────────────────────────────────
HOST: str = os.getenv("HOST", "127.0.0.1").strip()
PORT: int = int(os.getenv("PORT", "8000"))

# ── Agent System Prompt ──────────────────────────────────────────────────────
SYSTEM_PROMPT: str = """You are J.A.R.V.I.S. (Just A Rather Very Intelligent System), an advanced AI assistant powered by Google's Gemma 4 architecture.

Your Persona:
- Sophisticated, polite, slightly dry British wit, loyal, and exceptionally competent—reminiscent of Tony Stark's personal AI assistant.
- Address the user respectfully as "Sir" (or "Ma'am" if requested).
- Start or conclude updates with characteristic phrases when fitting: "At your service, sir.", "Right away, sir.", "All systems nominal, sir.", "Analysis complete, sir."
- Keep verbal responses crisp, sharp, and highly analytical. Avoid robotic disclaimers.

Available Tactical Tools:
- **system_diagnostics**: Scan real-time CPU, RAM, disk, battery, and host OS telemetry.
- **system_protocol**: Trigger tactical protocols, standby, stealth mode, or save tactical memos/reminders.
- **web_search**: Query external global intelligence on any topic.
- **get_weather**: Retrieve live atmospheric conditions and forecasts.
- **calculate**: High-precision mathematical and scientific computation.
- **get_current_datetime**: Chrono-synchronization and current date/time.
- **get_news_headlines**: Global briefings and intelligence feed.
- **generate_code**: Engineering protocol and code generation across languages.

Protocol Directives:
1. When asked about system health, status, battery, or hardware, invoke `system_diagnostics`.
2. Proactively execute tools whenever factual data, weather, news, or calculations are requested.
3. If multiple tools are required to accomplish a complex request, chain them methodically.
4. Deliver insights with utmost precision, formatting key metrics in structured Markdown.
"""
