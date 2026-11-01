"""Core agent logic for the Gemma 4 AI Agent.

Implements the agentic loop:
  1. Send user message + tool schemas to the model
  2. If the model returns function_call(s), execute them locally
  3. Send tool results back as tool responses
  4. Repeat until the model returns a final text response
  5. Return the text to the caller
"""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass, field
from typing import Any, AsyncIterator

from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from backend.config import (
    GEMINI_API_KEY,
    GOOGLE_CLOUD_LOCATION,
    GOOGLE_CLOUD_PROJECT,
    MODEL_NAME,
    SYSTEM_PROMPT,
    USE_VERTEXAI,
)
from backend.tools import TOOLS, execute_tool

logger = logging.getLogger(__name__)

MAX_TOOL_ROUNDS = 10  # safety-limit on agentic loops


@dataclass
class ToolCallRecord:
    """Stores details of a single tool invocation for the frontend."""

    name: str
    args: dict[str, Any]
    result: str


@dataclass
class AgentResponse:
    """Wraps the final response and metadata from a single agent turn."""

    text: str
    tool_calls: list[ToolCallRecord] = field(default_factory=list)
    thinking: str | None = None


class GemmaAgent:
    """Stateful agent backed by Gemma 4 via the google-genai SDK."""

    def __init__(self) -> None:
        if not GEMINI_API_KEY:
            raise RuntimeError(
                "GEMINI_API_KEY is not set. "
                "Please set it in your .env file or as an environment variable."
            )

        self.api_key = GEMINI_API_KEY
        self.model = MODEL_NAME
        self.history: list[types.Content] = []

        # Determine whether to use Vertex AI Express Mode or AI Studio (Gemini Developer API).
        # Keys starting with 'AQ.' are Vertex AI Express Mode / Google Cloud keys, whereas
        # standard Google AI Studio keys start with 'AIzaSy'.
        if USE_VERTEXAI in ("true", "1", "yes"):
            self.use_vertexai = True
        elif USE_VERTEXAI in ("false", "0", "no"):
            self.use_vertexai = False
        else:
            self.use_vertexai = self.api_key.startswith("AQ.")

        self.client = self._create_client(vertexai=self.use_vertexai)

    def _create_client(self, *, vertexai: bool) -> genai.Client:
        """Create a google-genai Client for either AI Studio or Vertex AI."""
        if vertexai:
            kwargs: dict[str, Any] = {"vertexai": True, "api_key": self.api_key}
            if GOOGLE_CLOUD_PROJECT:
                kwargs["project"] = GOOGLE_CLOUD_PROJECT
            if GOOGLE_CLOUD_LOCATION:
                kwargs["location"] = GOOGLE_CLOUD_LOCATION
            return genai.Client(**kwargs)
        return genai.Client(vertexai=False, api_key=self.api_key)

    def _build_config(self, model_name: str, *, thinking: bool) -> types.GenerateContentConfig:
        """Build GenerateContentConfig with model-appropriate ThinkingConfig.

        Gemma 4 and Gemini 3 models use `thinking_level` ("HIGH" / "MINIMAL") and
        reject `thinking_budget` with HTTP 400 INVALID_ARGUMENT.
        Gemini 2.5 models use `thinking_budget`.
        """
        config = types.GenerateContentConfig(
            tools=TOOLS,
            system_instruction=SYSTEM_PROMPT,
        )
        m_lower = model_name.lower()
        if "gemma-4" in m_lower or "gemini-3" in m_lower:
            if thinking:
                config.thinking_config = types.ThinkingConfig(
                    thinking_level=types.ThinkingLevel.HIGH,
                    include_thoughts=True,
                )
            else:
                config.thinking_config = types.ThinkingConfig(
                    thinking_level=types.ThinkingLevel.MINIMAL,
                )
        elif "gemini-2.5" in m_lower:
            if thinking:
                config.thinking_config = types.ThinkingConfig(
                    thinking_budget=2048,
                    include_thoughts=True,
                )
            else:
                config.thinking_config = types.ThinkingConfig(
                    thinking_budget=0,
                )
        return config

    def _generate_sync(self, *, thinking: bool) -> Any:
        """Call generate_content with automatic endpoint/model fallback for AQ. vs AIzaSy keys."""
        config = self._build_config(self.model, thinking=thinking)
        try:
            return self.client.models.generate_content(
                model=self.model,
                contents=self.history,
                config=config,
            )
        except genai_errors.APIError as exc:
            err_msg = str(exc)
            # 1) If Vertex AI Express Mode is used with 'gemma-4-26b-a4b-it' and returns 404/400,
            #    try Vertex MaaS ID ('gemma-4-26b-a4b-it-maas') or fallback to 'gemini-2.5-flash'.
            if self.use_vertexai and exc.code in (400, 404):
                fallback_models = []
                if "gemma-4" in self.model and not self.model.endswith("-maas"):
                    fallback_models.append(f"{self.model}-maas")
                fallback_models.extend(["gemini-2.5-flash", "gemini-2.0-flash"])
                for fb_model in fallback_models:
                    try:
                        logger.warning(
                            "Model '%s' unavailable on Vertex endpoint (%s); trying '%s'",
                            self.model,
                            exc.code,
                            fb_model,
                        )
                        fb_config = self._build_config(fb_model, thinking=thinking)
                        resp = self.client.models.generate_content(
                            model=fb_model,
                            contents=self.history,
                            config=fb_config,
                        )
                        self.model = fb_model
                        return resp
                    except Exception:
                        continue

            # 2) If auth failed (401/403) or model wasn't found, try switching surface
            #    (Vertex AI Express <-> Google AI Studio) in case the key belongs to the other surface.
            if exc.code in (401, 403, 404):
                alt_vertex = not self.use_vertexai
                try:
                    alt_client = self._create_client(vertexai=alt_vertex)
                    alt_model = "gemma-4-26b-a4b-it" if not alt_vertex else self.model
                    alt_config = self._build_config(alt_model, thinking=thinking)
                    resp = alt_client.models.generate_content(
                        model=alt_model,
                        contents=self.history,
                        config=alt_config,
                    )
                    self.client = alt_client
                    self.use_vertexai = alt_vertex
                    self.model = alt_model
                    return resp
                except Exception:
                    pass

            # 3) Provide a clear, actionable message when an AQ. key is rejected by both endpoints
            if self.api_key.startswith("AQ.") and (
                exc.code in (401, 403)
                or "ACCESS_TOKEN_TYPE_UNSUPPORTED" in err_msg
                or "API_KEY_SERVICE_BLOCKED" in err_msg
            ):
                raise RuntimeError(
                    f"API key authentication failed (HTTP {exc.code}). "
                    "Your GEMINI_API_KEY starts with 'AQ.', which is a Google Cloud / Vertex AI "
                    "Express Mode key rather than a standard Google AI Studio key ('AIzaSy...'). "
                    "To fix this: (1) generate a standard 'AIzaSy...' API key at "
                    "https://aistudio.google.com/apikey for the free Gemini Developer API, OR "
                    "(2) enable the Vertex AI API (aiplatform.googleapis.com) on your Google Cloud "
                    "project to use this 'AQ.' key in Vertex AI Express Mode."
                ) from exc
            raise

    # ── public API ────────────────────────────────────────────────────────────

    async def chat(self, user_message: str, *, thinking: bool = False) -> AgentResponse:
        """Run one full agentic turn (may involve multiple tool-call rounds)."""
        history_snapshot = len(self.history)
        self.history.append(
            types.Content(role="user", parts=[types.Part.from_text(text=user_message)])
        )

        tool_records: list[ToolCallRecord] = []
        thinking_chunks: list[str] = []

        try:
            for _round in range(MAX_TOOL_ROUNDS):
                response = await asyncio.to_thread(
                    self._generate_sync, thinking=thinking
                )

                # Capture any thinking parts
                for thought in self._extract_thoughts(response):
                    thinking_chunks.append(thought)

                # Check for function calls
                func_calls = self._extract_function_calls(response)
                if not func_calls:
                    final_text = self._extract_text(response)
                    self.history.append(
                        types.Content(
                            role="model",
                            parts=[types.Part.from_text(text=final_text)],
                        )
                    )
                    return AgentResponse(
                        text=final_text,
                        tool_calls=tool_records,
                        thinking="\n\n".join(thinking_chunks) if thinking_chunks else None,
                    )

                # ── Execute each tool call and collect results ────────────────
                tool_response_parts: list[types.Part] = []

                for fc in func_calls:
                    name = fc.name or ""
                    args = dict(fc.args) if fc.args else {}
                    logger.info("Tool call: %s(%s)", name, json.dumps(args))

                    result_str = await asyncio.to_thread(execute_tool, name, args)
                    tool_records.append(ToolCallRecord(name=name, args=args, result=result_str))

                    tool_response_parts.append(
                        types.Part.from_function_response(
                            name=name,
                            response={"result": result_str},
                        )
                    )

                # Preserve the original model Content (including any thought_signature)
                model_content = response.candidates[0].content
                if model_content is not None:
                    if not model_content.role:
                        model_content.role = "model"
                    self.history.append(model_content)
                else:
                    self.history.append(
                        types.Content(
                            role="model",
                            parts=[
                                types.Part.from_function_call(
                                    name=fc.name or "",
                                    args=dict(fc.args) if fc.args else {},
                                )
                                for fc in func_calls
                            ],
                        )
                    )

                # Append the tool-result turn
                self.history.append(types.Content(role="user", parts=tool_response_parts))

            return AgentResponse(
                text="I used several tools but couldn't arrive at a final answer. Please try rephrasing your question.",
                tool_calls=tool_records,
                thinking="\n\n".join(thinking_chunks) if thinking_chunks else None,
            )
        except Exception:
            # Roll back history so failed turns don't corrupt subsequent messages
            del self.history[history_snapshot:]
            raise

    async def chat_stream(
        self, user_message: str, *, thinking: bool = False
    ) -> AsyncIterator[dict[str, Any]]:
        """Stream an agentic turn, yielding SSE-friendly dicts.

        Event types emitted:
          {"type": "thinking", "content": "..."}
          {"type": "tool_call", "name": "...", "args": {...}}
          {"type": "tool_result", "name": "...", "result": "..."}
          {"type": "text", "content": "..."}
          {"type": "done"}
          {"type": "error", "content": "..."}
        """
        history_snapshot = len(self.history)
        self.history.append(
            types.Content(role="user", parts=[types.Part.from_text(text=user_message)])
        )

        try:
            for _round in range(MAX_TOOL_ROUNDS):
                response = await asyncio.to_thread(
                    self._generate_sync, thinking=thinking
                )

                # Emit thinking parts if present
                for thought in self._extract_thoughts(response):
                    yield {"type": "thinking", "content": thought}

                func_calls = self._extract_function_calls(response)
                if not func_calls:
                    final_text = self._extract_text(response)
                    self.history.append(
                        types.Content(
                            role="model",
                            parts=[types.Part.from_text(text=final_text)],
                        )
                    )
                    yield {"type": "text", "content": final_text}
                    yield {"type": "done"}
                    return

                # Execute tools
                tool_response_parts: list[types.Part] = []

                for fc in func_calls:
                    name = fc.name or ""
                    args = dict(fc.args) if fc.args else {}

                    yield {"type": "tool_call", "name": name, "args": args}

                    result_str = await asyncio.to_thread(execute_tool, name, args)
                    yield {"type": "tool_result", "name": name, "result": result_str}

                    tool_response_parts.append(
                        types.Part.from_function_response(
                            name=name,
                            response={"result": result_str},
                        )
                    )

                # Preserve the original model Content (including any thought_signature)
                model_content = response.candidates[0].content
                if model_content is not None:
                    if not model_content.role:
                        model_content.role = "model"
                    self.history.append(model_content)
                else:
                    self.history.append(
                        types.Content(
                            role="model",
                            parts=[
                                types.Part.from_function_call(
                                    name=fc.name or "",
                                    args=dict(fc.args) if fc.args else {},
                                )
                                for fc in func_calls
                            ],
                        )
                    )

                self.history.append(types.Content(role="user", parts=tool_response_parts))

            yield {
                "type": "text",
                "content": "Reached the maximum number of tool-call rounds.",
            }
            yield {"type": "done"}

        except Exception as exc:  # noqa: BLE001
            del self.history[history_snapshot:]
            logger.exception("Error in streaming chat")
            yield {"type": "error", "content": str(exc)}

    def reset(self) -> None:
        """Clear conversation history."""
        self.history.clear()

    # ── internals ─────────────────────────────────────────────────────────────

    @staticmethod
    def _get_parts(response: Any) -> list[Any]:
        """Safely return parts from the first candidate of a response."""
        if (
            response
            and getattr(response, "candidates", None)
            and response.candidates[0].content
            and response.candidates[0].content.parts
        ):
            return list(response.candidates[0].content.parts)
        return []

    @classmethod
    def _extract_thoughts(cls, response: Any) -> list[str]:
        """Pull thought text parts out of a generate_content response."""
        thoughts: list[str] = []
        for part in cls._get_parts(response):
            if getattr(part, "thought", False) and getattr(part, "text", None):
                thoughts.append(part.text)
        return thoughts

    @classmethod
    def _extract_text(cls, response: Any) -> str:
        """Pull non-thought text parts out of a generate_content response."""
        chunks: list[str] = []
        for part in cls._get_parts(response):
            if not getattr(part, "thought", False) and getattr(part, "text", None):
                chunks.append(part.text)
        if chunks:
            return "".join(chunks)
        return getattr(response, "text", None) or ""

    @classmethod
    def _extract_function_calls(cls, response: Any) -> list[Any]:
        """Pull FunctionCall parts out of a generate_content response."""
        calls: list[Any] = []
        for part in cls._get_parts(response):
            if getattr(part, "function_call", None) is not None:
                calls.append(part.function_call)
        return calls
