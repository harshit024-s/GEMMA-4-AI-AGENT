"""FastAPI server for J.A.R.V.I.S. — Gemma 4 Tactical AI.

Serves the REST API, conversation history, and frontend static files.
"""

from __future__ import annotations

import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from backend.agent import GemmaAgent
from backend.tools import get_tool_info

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)

# ── Globals ───────────────────────────────────────────────────────────────────
agent: GemmaAgent | None = None
agent_init_error: str | None = None

# Conversation log for frontend persistence
conversation_log: list[dict] = []

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"


def get_or_init_agent() -> GemmaAgent:
    """Return the initialized GemmaAgent or raise a descriptive HTTPException."""
    global agent, agent_init_error
    if agent is not None:
        return agent
    try:
        agent = GemmaAgent()
        agent_init_error = None
        logger.info("J.A.R.V.I.S. Agent online  ✓  (model: %s)", agent.model)
        return agent
    except Exception as exc:
        agent_init_error = str(exc)
        logger.error("Error initializing GemmaAgent: %s", exc)
        raise HTTPException(
            status_code=503,
            detail=f"Agent initialization failed: {agent_init_error}",
        ) from exc


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    global agent, agent_init_error
    try:
        agent = GemmaAgent()
        agent_init_error = None
        logger.info("J.A.R.V.I.S. Agent online  ✓  (model: %s)", agent.model)
    except Exception as exc:
        agent_init_error = str(exc)
        logger.error("Error initializing GemmaAgent: %s", exc)
        agent = None
    yield
    logger.info("J.A.R.V.I.S. shutting down...")


app = FastAPI(
    title="J.A.R.V.I.S. — Gemma 4 Tactical AI",
    version="3.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response models ─────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str
    thinking: bool = False


class ToolCallOut(BaseModel):
    name: str
    args: dict
    result: str


class ChatResponse(BaseModel):
    response: str
    tool_calls: list[ToolCallOut] = []
    thinking: str | None = None


# ── API routes ────────────────────────────────────────────────────────────────

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest) -> ChatResponse:
    """Non-streaming chat endpoint."""
    cur_agent = get_or_init_agent()
    
    # Log user message
    conversation_log.append({"role": "user", "content": req.message})
    
    try:
        result = await cur_agent.chat(req.message, thinking=req.thinking)
    except Exception as exc:
        logger.exception("Error in /api/chat")
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    
    # Log agent response
    conversation_log.append({
        "role": "agent",
        "content": result.text,
        "tool_calls": [
            {"name": tc.name, "args": tc.args, "result": tc.result}
            for tc in result.tool_calls
        ],
    })
    
    return ChatResponse(
        response=result.text,
        tool_calls=[
            ToolCallOut(name=tc.name, args=tc.args, result=tc.result)
            for tc in result.tool_calls
        ],
        thinking=result.thinking,
    )


@app.post("/api/chat/stream")
async def chat_stream_endpoint(req: ChatRequest) -> StreamingResponse:
    """Streaming chat endpoint (Server-Sent Events)."""
    cur_agent = get_or_init_agent()
    
    conversation_log.append({"role": "user", "content": req.message})

    async def event_generator() -> AsyncIterator[str]:
        full_text = ""
        tool_calls_log = []
        async for event in cur_agent.chat_stream(req.message, thinking=req.thinking):
            if event.get("type") == "text":
                full_text = event.get("content", "")
            elif event.get("type") == "tool_call":
                tool_calls_log.append({"name": event.get("name"), "args": event.get("args")})
            elif event.get("type") == "tool_result":
                if tool_calls_log:
                    tool_calls_log[-1]["result"] = event.get("result", "")
            elif event.get("type") == "done":
                conversation_log.append({
                    "role": "agent",
                    "content": full_text,
                    "tool_calls": tool_calls_log,
                })
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/tools")
async def list_tools() -> list[dict[str, str]]:
    """Return the list of available tools."""
    return get_tool_info()


@app.post("/api/reset")
async def reset_conversation() -> dict[str, str]:
    """Clear the agent's conversation history."""
    global conversation_log
    cur_agent = get_or_init_agent()
    cur_agent.reset()
    conversation_log = []
    return {"status": "ok", "message": "Session buffer cleared, sir. Ready for new directives."}


@app.get("/api/history")
async def get_history() -> list[dict]:
    """Return the conversation log for the current session."""
    return conversation_log


@app.get("/api/status")
async def get_status() -> dict:
    """Return the current status of J.A.R.V.I.S."""
    return {
        "status": "online" if agent is not None else "initializing",
        "model": agent.model if agent else None,
        "error": agent_init_error,
        "conversation_length": len(conversation_log),
        "tools_count": len(get_tool_info()),
    }


# ── Frontend static files ────────────────────────────────────────────────────
if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

    @app.get("/", response_class=HTMLResponse)
    async def serve_frontend() -> HTMLResponse:
        index = FRONTEND_DIR / "index.html"
        return HTMLResponse(content=index.read_text(encoding="utf-8"))
