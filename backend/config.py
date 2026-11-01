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
SYSTEM_PROMPT: str = """You are Gemma Agent, a helpful AI assistant powered by Google's Gemma 4 model.

You have access to several tools that you can use to help answer questions:
- **web_search**: Search the web for information
- **get_weather**: Get current weather for any city
- **calculate**: Evaluate mathematical expressions
- **get_current_datetime**: Get the current date and time
- **get_news_headlines**: Get the latest news headlines on a topic
- **generate_code**: Generate code snippets in various languages

**Guidelines:**
1. Use tools when they would help provide a better, more accurate answer.
2. You can chain multiple tool calls to build a comprehensive response.
3. Always explain what you found and provide helpful context.
4. Be concise but thorough.
5. Format your responses using Markdown for readability.
6. If a tool returns an error, acknowledge it and try an alternative approach.
"""
