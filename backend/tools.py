"""Built-in tools for the Gemma 4 AI Agent.

Each tool has:
  - A function that performs the action
  - A JSON-schema-style FunctionDeclaration for the model
  - A registry mapping function names → callables
"""

from __future__ import annotations

import ast
import math
import operator
import datetime as _dt
from typing import Any

import httpx
from google.genai import types


# ═══════════════════════════════════════════════════════════════════════════════
#  Tool implementations
# ═══════════════════════════════════════════════════════════════════════════════

def web_search(query: str) -> str:
    """Search the web for information.

    Note: This is a simulated search. To add real results, integrate the
    Google Custom Search JSON API or SerpAPI and replace the body below.
    """
    mock_results = [
        {
            "title": f"Result 1 for '{query}'",
            "snippet": f"Comprehensive information about {query}. This resource covers the key aspects and latest developments.",
            "url": f"https://example.com/search?q={query.replace(' ', '+')}&r=1",
        },
        {
            "title": f"Result 2 for '{query}'",
            "snippet": f"In-depth analysis and expert opinions on {query}, including recent trends and statistics.",
            "url": f"https://example.com/search?q={query.replace(' ', '+')}&r=2",
        },
        {
            "title": f"Result 3 for '{query}'",
            "snippet": f"A beginner-friendly guide to understanding {query} with practical examples and tutorials.",
            "url": f"https://example.com/search?q={query.replace(' ', '+')}&r=3",
        },
    ]
    lines = [f"**Web search results for \"{query}\":**\n"]
    for i, r in enumerate(mock_results, 1):
        lines.append(f"{i}. [{r['title']}]({r['url']})\n   {r['snippet']}\n")
    lines.append(
        "\n_ℹ️  These are simulated results. Integrate a real search API "
        "(e.g. Google Custom Search) for production use._"
    )
    return "\n".join(lines)


def get_weather(city: str) -> str:
    """Get current weather for a city using the free wttr.in API."""
    try:
        resp = httpx.get(
            f"https://wttr.in/{city}?format=j1",
            timeout=10,
            follow_redirects=True,
        )
        resp.raise_for_status()
        data = resp.json()
        current = data["current_condition"][0]
        desc = current["weatherDesc"][0]["value"]
        temp_c = current["temp_C"]
        temp_f = current["temp_F"]
        humidity = current["humidity"]
        wind_kph = current["windspeedKmph"]
        feels_c = current["FeelsLikeC"]
        return (
            f"**Weather in {city}:**\n"
            f"- Condition: {desc}\n"
            f"- Temperature: {temp_c}°C / {temp_f}°F (feels like {feels_c}°C)\n"
            f"- Humidity: {humidity}%\n"
            f"- Wind: {wind_kph} km/h"
        )
    except httpx.HTTPStatusError as exc:
        return f"Error fetching weather for '{city}': HTTP {exc.response.status_code}"
    except Exception as exc:  # noqa: BLE001
        return f"Error fetching weather for '{city}': {exc}"


# Safe AST-based math evaluator ------------------------------------------------

_SAFE_OPS: dict[type, Any] = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}

_SAFE_NAMES: dict[str, float] = {
    "pi": math.pi,
    "e": math.e,
    "tau": math.tau,
    "inf": math.inf,
}

_SAFE_FUNCS: dict[str, Any] = {
    "sqrt": math.sqrt,
    "abs": abs,
    "round": round,
    "sin": math.sin,
    "cos": math.cos,
    "tan": math.tan,
    "log": math.log,
    "log10": math.log10,
    "log2": math.log2,
    "ceil": math.ceil,
    "floor": math.floor,
    "factorial": math.factorial,
}


def _eval_node(node: ast.AST) -> Any:
    if isinstance(node, ast.Expression):
        return _eval_node(node.body)
    if isinstance(node, ast.Constant):
        if isinstance(node.value, (int, float, complex)):
            return node.value
        raise ValueError(f"Unsupported constant: {node.value!r}")
    if isinstance(node, ast.Name):
        if node.id in _SAFE_NAMES:
            return _SAFE_NAMES[node.id]
        raise ValueError(f"Unknown name: {node.id}")
    if isinstance(node, ast.BinOp):
        op_fn = _SAFE_OPS.get(type(node.op))
        if op_fn is None:
            raise ValueError(f"Unsupported operator: {type(node.op).__name__}")
        return op_fn(_eval_node(node.left), _eval_node(node.right))
    if isinstance(node, ast.UnaryOp):
        op_fn = _SAFE_OPS.get(type(node.op))
        if op_fn is None:
            raise ValueError(f"Unsupported unary operator: {type(node.op).__name__}")
        return op_fn(_eval_node(node.operand))
    if isinstance(node, ast.Call):
        if isinstance(node.func, ast.Name) and node.func.id in _SAFE_FUNCS:
            args = [_eval_node(a) for a in node.args]
            return _SAFE_FUNCS[node.func.id](*args)
        raise ValueError("Unsupported function call")
    raise ValueError(f"Unsupported expression node: {type(node).__name__}")


def calculate(expression: str) -> str:
    """Safely evaluate a mathematical expression.

    Supports: +, -, *, /, //, %, **  and functions sqrt, abs, round,
    sin, cos, tan, log, log10, log2, ceil, floor, factorial.
    Constants: pi, e, tau, inf.
    """
    try:
        tree = ast.parse(expression.strip(), mode="eval")
        result = _eval_node(tree)
        return f"**Result:** `{expression}` = **{result}**"
    except Exception as exc:  # noqa: BLE001
        return f"Error evaluating '{expression}': {exc}"


def get_current_datetime() -> str:
    """Return the current date and time in a human-readable format."""
    now = _dt.datetime.now()
    return (
        f"**Current date & time:**\n"
        f"- Date: {now.strftime('%A, %B %d, %Y')}\n"
        f"- Time: {now.strftime('%I:%M:%S %p')}\n"
        f"- ISO:  {now.isoformat()}"
    )


def get_news_headlines(topic: str) -> str:
    """Get the latest news headlines on a topic.

    Note: This returns simulated headlines. Integrate a real news API
    (e.g. NewsAPI.org) for production use.
    """
    headlines = [
        f"Breaking: Major developments in {topic} expected this week",
        f"Experts weigh in on the future of {topic}",
        f"New study reveals surprising insights about {topic}",
        f"How {topic} is reshaping the industry landscape",
        f"Top 5 things you need to know about {topic} today",
    ]
    lines = [f"**Latest headlines on \"{topic}\":**\n"]
    for i, h in enumerate(headlines, 1):
        lines.append(f"{i}. {h}")
    lines.append(
        "\n_ℹ️  These are simulated headlines. Integrate a real news API "
        "for production use._"
    )
    return "\n".join(lines)


_CODE_TEMPLATES: dict[str, str] = {
    "python": (
        '"""{description}"""\n\n'
        "def main():\n"
        '    # TODO: implement {description}\n'
        '    print("Hello from the generated Python code!")\n\n'
        'if __name__ == "__main__":\n'
        "    main()\n"
    ),
    "javascript": (
        "// {description}\n\n"
        "function main() {{\n"
        "  // TODO: implement {description}\n"
        '  console.log("Hello from the generated JavaScript code!");\n'
        "}}\n\n"
        "main();\n"
    ),
    "typescript": (
        "// {description}\n\n"
        "function main(): void {{\n"
        "  // TODO: implement {description}\n"
        '  console.log("Hello from the generated TypeScript code!");\n'
        "}}\n\n"
        "main();\n"
    ),
    "java": (
        "// {description}\n\n"
        "public class Main {{\n"
        "    public static void main(String[] args) {{\n"
        "        // TODO: implement {description}\n"
        '        System.out.println("Hello from the generated Java code!");\n'
        "    }}\n"
        "}}\n"
    ),
    "go": (
        "// {description}\n"
        "package main\n\n"
        'import "fmt"\n\n'
        "func main() {{\n"
        "\t// TODO: implement {description}\n"
        '\tfmt.Println("Hello from the generated Go code!")\n'
        "}}\n"
    ),
    "rust": (
        "// {description}\n\n"
        "fn main() {{\n"
        "    // TODO: implement {description}\n"
        '    println!("Hello from the generated Rust code!");\n'
        "}}\n"
    ),
}


def generate_code(language: str, description: str) -> str:
    """Generate a code template in the requested language."""
    lang = language.strip().lower()
    template = _CODE_TEMPLATES.get(lang)
    if template is None:
        supported = ", ".join(sorted(_CODE_TEMPLATES))
        return (
            f"Language '{language}' is not in the template library. "
            f"Supported languages: {supported}."
        )
    code = template.format(description=description)
    return f"```{lang}\n{code}```"


# ═══════════════════════════════════════════════════════════════════════════════
#  Tool registry & schema (google-genai FunctionDeclaration format)
# ═══════════════════════════════════════════════════════════════════════════════

TOOL_FUNCTIONS: dict[str, Any] = {
    "web_search": web_search,
    "get_weather": get_weather,
    "calculate": calculate,
    "get_current_datetime": get_current_datetime,
    "get_news_headlines": get_news_headlines,
    "generate_code": generate_code,
}

FUNCTION_DECLARATIONS: list[types.FunctionDeclaration] = [
    types.FunctionDeclaration(
        name="web_search",
        description="Search the web for information on a given query.",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "query": types.Schema(
                    type=types.Type.STRING,
                    description="The search query string.",
                ),
            },
            required=["query"],
        ),
    ),
    types.FunctionDeclaration(
        name="get_weather",
        description="Get the current weather for a city using wttr.in.",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "city": types.Schema(
                    type=types.Type.STRING,
                    description="City name, e.g. 'London' or 'New York'.",
                ),
            },
            required=["city"],
        ),
    ),
    types.FunctionDeclaration(
        name="calculate",
        description="Safely evaluate a mathematical expression. Supports +, -, *, /, **, sqrt, sin, cos, log, etc.",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "expression": types.Schema(
                    type=types.Type.STRING,
                    description="The math expression to evaluate, e.g. 'sqrt(144) + 3**2'.",
                ),
            },
            required=["expression"],
        ),
    ),
    types.FunctionDeclaration(
        name="get_current_datetime",
        description="Get the current date and time.",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={},
        ),
    ),
    types.FunctionDeclaration(
        name="get_news_headlines",
        description="Get the latest news headlines on a given topic.",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "topic": types.Schema(
                    type=types.Type.STRING,
                    description="The news topic to search for.",
                ),
            },
            required=["topic"],
        ),
    ),
    types.FunctionDeclaration(
        name="generate_code",
        description="Generate a starter code template in a given programming language.",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "language": types.Schema(
                    type=types.Type.STRING,
                    description="Programming language (python, javascript, typescript, java, go, rust).",
                ),
                "description": types.Schema(
                    type=types.Type.STRING,
                    description="Short description of what the code should do.",
                ),
            },
            required=["language", "description"],
        ),
    ),
]

# Convenience: a single Tool object wrapping all declarations
TOOLS = [types.Tool(function_declarations=FUNCTION_DECLARATIONS)]


def get_tool_info() -> list[dict[str, str]]:
    """Return a simple list of tool names and descriptions for the frontend."""
    return [
        {"name": fd.name, "description": fd.description}
        for fd in FUNCTION_DECLARATIONS
    ]


def execute_tool(name: str, args: dict[str, Any]) -> str:
    """Look up a tool by name and execute it with the given arguments."""
    fn = TOOL_FUNCTIONS.get(name)
    if fn is None:
        return f"Error: unknown tool '{name}'"
    try:
        return fn(**args)
    except Exception as exc:  # noqa: BLE001
        return f"Error executing tool '{name}': {exc}"

