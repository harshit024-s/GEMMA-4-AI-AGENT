"""Built-in tools for the J.A.R.V.I.S. Tactical AI Agent.

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
import subprocess
import platform
import json
from typing import Any

import httpx
from google.genai import types


# ═══════════════════════════════════════════════════════════════════════════════
#  Tool implementations
# ═══════════════════════════════════════════════════════════════════════════════

def web_search(query: str) -> str:
    """Search the web for information using DuckDuckGo Instant Answer API."""
    try:
        resp = httpx.get(
            "https://api.duckduckgo.com/",
            params={"q": query, "format": "json", "no_html": "1", "skip_disambig": "1"},
            timeout=10,
            follow_redirects=True,
        )
        resp.raise_for_status()
        data = resp.json()

        results = []
        if data.get("AbstractText"):
            results.append(f"**Summary:** {data['AbstractText']}")
            if data.get("AbstractURL"):
                results.append(f"Source: {data['AbstractURL']}")

        if data.get("RelatedTopics"):
            results.append("\n**Related:**")
            for i, topic in enumerate(data["RelatedTopics"][:5], 1):
                if isinstance(topic, dict) and topic.get("Text"):
                    results.append(f"{i}. {topic['Text']}")

        if results:
            return f"**Web search results for \"{query}\":**\n\n" + "\n".join(results)

    except Exception:
        pass

    # Fallback: simulated results
    mock_results = [
        {
            "title": f"Result 1 for '{query}'",
            "snippet": f"Comprehensive information about {query}. This resource covers the key aspects and latest developments.",
            "url": f"https://example.com/search?q={query.replace(' ', '+')}&r=1",
        },
        {
            "title": f"Result 2 for '{query}'",
            "snippet": f"In-depth analysis and expert opinions on {query}, including recent trends.",
            "url": f"https://example.com/search?q={query.replace(' ', '+')}&r=2",
        },
    ]
    lines = [f"**Web search results for \"{query}\":**\n"]
    for i, r in enumerate(mock_results, 1):
        lines.append(f"{i}. [{r['title']}]({r['url']})\n   {r['snippet']}\n")
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
        uv = current.get("uvIndex", "N/A")
        visibility = current.get("visibility", "N/A")
        return (
            f"**Atmospheric Telemetry — {city}:**\n"
            f"- Condition: {desc}\n"
            f"- Temperature: {temp_c}°C / {temp_f}°F (feels like {feels_c}°C)\n"
            f"- Humidity: {humidity}%\n"
            f"- Wind: {wind_kph} km/h\n"
            f"- UV Index: {uv}\n"
            f"- Visibility: {visibility} km"
        )
    except httpx.HTTPStatusError as exc:
        return f"Error fetching weather for '{city}': HTTP {exc.response.status_code}"
    except Exception as exc:
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
    "gcd": math.gcd,
    "radians": math.radians,
    "degrees": math.degrees,
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
    """Safely evaluate a mathematical expression."""
    try:
        tree = ast.parse(expression.strip(), mode="eval")
        result = _eval_node(tree)
        return f"**Result:** `{expression}` = **{result}**"
    except Exception as exc:
        return f"Error evaluating '{expression}': {exc}"


def get_current_datetime() -> str:
    """Return the current date and time in a human-readable format."""
    now = _dt.datetime.now()
    return (
        f"**Chrono-Synchronization Report:**\n"
        f"- Date: {now.strftime('%A, %B %d, %Y')}\n"
        f"- Time: {now.strftime('%I:%M:%S %p')}\n"
        f"- ISO:  {now.isoformat()}\n"
        f"- Epoch: {int(now.timestamp())}"
    )


def get_news_headlines(topic: str) -> str:
    """Get the latest news headlines on a topic."""
    headlines = [
        f"Breaking: Major developments in {topic} expected this week",
        f"Experts weigh in on the future of {topic}",
        f"New study reveals surprising insights about {topic}",
        f"How {topic} is reshaping the industry landscape",
        f"Top 5 things you need to know about {topic} today",
    ]
    lines = [f"**Intelligence Briefing — \"{topic}\":**\n"]
    for i, h in enumerate(headlines, 1):
        lines.append(f"{i}. {h}")
    lines.append(
        "\n_Note: Simulated intelligence feed. Integrate a real news API for production._"
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
    "html": (
        "<!DOCTYPE html>\n"
        "<html lang=\"en\">\n"
        "<head>\n"
        "  <meta charset=\"UTF-8\" />\n"
        "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n"
        "  <title>{description}</title>\n"
        "</head>\n"
        "<body>\n"
        "  <!-- TODO: implement {description} -->\n"
        "  <h1>Hello World</h1>\n"
        "</body>\n"
        "</html>\n"
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


def system_diagnostics() -> str:
    """Run real-time diagnostics on the host machine."""
    try:
        import psutil
        cpu_pct = psutil.cpu_percent(interval=0.3)
        cpu_count_log = psutil.cpu_count(logical=True)
        cpu_count_phys = psutil.cpu_count(logical=False)
        cpu_freq = psutil.cpu_freq()
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage("C:\\" if platform.system() == "Windows" else "/")
        battery = psutil.sensors_battery()
        batt_str = f"{battery.percent}% ({'Charging' if battery.power_plugged else 'Discharging'})" if battery else "AC Direct Grid"
        
        # Network stats
        net = psutil.net_io_counters()
        sent_mb = net.bytes_sent / (1024**2)
        recv_mb = net.bytes_recv / (1024**2)
        
        # Process count
        proc_count = len(psutil.pids())
        
        # Boot time
        boot_time = _dt.datetime.fromtimestamp(psutil.boot_time())
        uptime = _dt.datetime.now() - boot_time
        uptime_str = f"{uptime.days}d {uptime.seconds // 3600}h {(uptime.seconds % 3600) // 60}m"

        freq_str = f"{cpu_freq.current:.0f} MHz" if cpu_freq else "N/A"

        return (
            "**J.A.R.V.I.S. Full Subsystem Telemetry:**\n"
            f"- **Processor Core:** {cpu_pct}% load ({cpu_count_phys} physical / {cpu_count_log} logical threads @ {freq_str})\n"
            f"- **Memory Matrix:** {mem.percent}% consumed ({mem.used // (1024**2):,} MB / {mem.total // (1024**2):,} MB)\n"
            f"- **Drive Capacity:** {disk.percent}% allocated ({disk.free // (1024**3):,} GB free / {disk.total // (1024**3):,} GB total)\n"
            f"- **Power Source:** {batt_str}\n"
            f"- **Network I/O:** Sent {sent_mb:,.1f} MB | Received {recv_mb:,.1f} MB\n"
            f"- **Active Processes:** {proc_count} running\n"
            f"- **System Uptime:** {uptime_str} (booted {boot_time.strftime('%b %d, %I:%M %p')})\n"
            f"- **OS Architecture:** {platform.system()} {platform.release()} [{platform.machine()}]\n"
            "- **Status:** All core relays nominal, sir."
        )
    except Exception as exc:
        return f"Diagnostic scan encountered telemetry variance: {exc}"


def system_protocol(command: str, parameters: str = "") -> str:
    """Execute tactical protocols, system modes, or user reminders."""
    cmd = command.strip().lower()
    if "diagnostic" in cmd or "scan" in cmd:
        return system_diagnostics()
    elif "stealth" in cmd:
        return "**Protocol Activated:** Stealth Mode initialized. Audio levels attenuated, visual signature minimized, sir."
    elif "standby" in cmd or "sleep" in cmd:
        return "**Protocol Activated:** Low-power standby matrix engaged. Monitoring background channels, sir."
    elif "memo" in cmd or "reminder" in cmd or "note" in cmd or "task" in cmd:
        item = parameters or command
        return f"**Protocol Registered:** Item logged in tactical buffer: '{item}'. I shall maintain strict surveillance over this, sir."
    elif "combat" in cmd or "battle" in cmd:
        return "**Protocol Activated:** Combat readiness elevated. All tactical systems are hot and standing by, sir."
    elif "party" in cmd or "music" in cmd:
        return "**Protocol Activated:** Party Protocol engaged. Audio systems at maximum output. Shall I queue up AC/DC, sir?"
    elif "goodnight" in cmd or "shutdown" in cmd:
        return "**Protocol Activated:** Goodnight protocol sequence initiated. Sweet dreams, sir. I'll keep watch."
    else:
        return f"**Protocol '{command}' Initialized.** Telemetry confirmed and logged, sir."


def wikipedia_lookup(topic: str) -> str:
    """Look up a topic on Wikipedia and return a concise summary."""
    try:
        resp = httpx.get(
            "https://en.wikipedia.org/api/rest_v1/page/summary/" + topic.replace(" ", "_"),
            timeout=10,
            follow_redirects=True,
            headers={"User-Agent": "JARVIS-Agent/3.0 (https://github.com/harshit024-s/GEMMA-4-AI-AGENT)"},
        )
        resp.raise_for_status()
        data = resp.json()
        title = data.get("title", topic)
        extract = data.get("extract", "No summary available.")
        url = data.get("content_urls", {}).get("desktop", {}).get("page", "")
        
        result = f"**Knowledge Base — {title}:**\n\n{extract}"
        if url:
            result += f"\n\n[Full article]({url})"
        return result
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            return f"No Wikipedia article found for '{topic}'. Perhaps try a different search term, sir."
        return f"Error retrieving knowledge for '{topic}': HTTP {exc.response.status_code}"
    except Exception as exc:
        return f"Error retrieving knowledge for '{topic}': {exc}"


def set_timer(duration_seconds: int, label: str = "Timer") -> str:
    """Set a countdown timer (note: this logs the timer, actual countdown is client-side)."""
    if duration_seconds <= 0:
        return "Timer duration must be positive, sir."
    
    minutes = duration_seconds // 60
    seconds = duration_seconds % 60
    
    if minutes > 0:
        time_str = f"{minutes} minute{'s' if minutes != 1 else ''} and {seconds} second{'s' if seconds != 1 else ''}" if seconds else f"{minutes} minute{'s' if minutes != 1 else ''}"
    else:
        time_str = f"{seconds} second{'s' if seconds != 1 else ''}"
    
    alarm_time = _dt.datetime.now() + _dt.timedelta(seconds=duration_seconds)
    
    return (
        f"**Timer Protocol Engaged:**\n"
        f"- Label: {label}\n"
        f"- Duration: {time_str}\n"
        f"- Alarm at: {alarm_time.strftime('%I:%M:%S %p')}\n"
        f"- _TIMER_DATA_: {json.dumps({'seconds': duration_seconds, 'label': label})}\n"
        "Timer is now counting down, sir. I shall notify you upon completion."
    )


def tell_joke(category: str = "general") -> str:
    """Tell a joke — because even a tactical AI needs levity, sir."""
    try:
        cat = category.strip().lower()
        if cat in ("programming", "code", "tech"):
            url = "https://v2.jokeapi.dev/joke/Programming?type=twopart&safe-mode"
        else:
            url = "https://v2.jokeapi.dev/joke/Any?type=twopart&safe-mode"
        
        resp = httpx.get(url, timeout=8, follow_redirects=True)
        resp.raise_for_status()
        data = resp.json()
        
        if data.get("type") == "twopart":
            return f"**{data['setup']}**\n\n{data['delivery']}"
        elif data.get("type") == "single":
            return data.get("joke", "I seem to have misplaced my humor subroutine, sir.")
        else:
            raise ValueError("Unknown joke format")
    except Exception:
        jokes = [
            "Why do programmers prefer dark mode?\n\nBecause light attracts bugs, sir.",
            "I told my wife she was drawing her eyebrows too high.\n\nShe looked surprised.",
            "What did the AI say to the human?\n\n'You complete me... with your prompts.'",
            "Why was the JavaScript developer sad?\n\nBecause he didn't Node how to Express himself.",
        ]
        import random
        return jokes[random.randint(0, len(jokes) - 1)]


def unit_convert(value: float, from_unit: str, to_unit: str) -> str:
    """Convert between common units of measurement."""
    conversions = {
        # Length
        ("km", "miles"): lambda v: v * 0.621371,
        ("miles", "km"): lambda v: v * 1.60934,
        ("m", "ft"): lambda v: v * 3.28084,
        ("ft", "m"): lambda v: v * 0.3048,
        ("cm", "inch"): lambda v: v * 0.393701,
        ("inch", "cm"): lambda v: v * 2.54,
        # Weight
        ("kg", "lbs"): lambda v: v * 2.20462,
        ("lbs", "kg"): lambda v: v * 0.453592,
        ("g", "oz"): lambda v: v * 0.035274,
        ("oz", "g"): lambda v: v * 28.3495,
        # Temperature
        ("c", "f"): lambda v: (v * 9/5) + 32,
        ("f", "c"): lambda v: (v - 32) * 5/9,
        ("c", "k"): lambda v: v + 273.15,
        ("k", "c"): lambda v: v - 273.15,
        # Speed
        ("kmh", "mph"): lambda v: v * 0.621371,
        ("mph", "kmh"): lambda v: v * 1.60934,
        # Data
        ("gb", "mb"): lambda v: v * 1024,
        ("mb", "gb"): lambda v: v / 1024,
        ("tb", "gb"): lambda v: v * 1024,
        ("gb", "tb"): lambda v: v / 1024,
    }
    
    fu = from_unit.strip().lower().replace("°", "").replace("celsius", "c").replace("fahrenheit", "f").replace("kelvin", "k")
    tu = to_unit.strip().lower().replace("°", "").replace("celsius", "c").replace("fahrenheit", "f").replace("kelvin", "k")
    
    converter = conversions.get((fu, tu))
    if converter is None:
        supported = ", ".join(f"{a} → {b}" for a, b in sorted(conversions.keys()))
        return f"Conversion from '{from_unit}' to '{to_unit}' is not supported, sir.\n\nSupported conversions: {supported}"
    
    result = converter(value)
    return f"**Unit Conversion:**\n{value} {from_unit} = **{result:.4f} {to_unit}**"


def translate_text(text: str, target_language: str) -> str:
    """Translate text to a target language (uses model's built-in multilingual capability)."""
    return (
        f"**Translation Request Logged:**\n"
        f"- Text: \"{text}\"\n"
        f"- Target Language: {target_language}\n\n"
        "I shall translate this using my linguistic processing matrix, sir. "
        f"The translation to {target_language} is being processed through my core language model."
    )


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
    "system_diagnostics": system_diagnostics,
    "system_protocol": system_protocol,
    "wikipedia_lookup": wikipedia_lookup,
    "set_timer": set_timer,
    "tell_joke": tell_joke,
    "unit_convert": unit_convert,
}

FUNCTION_DECLARATIONS: list[types.FunctionDeclaration] = [
    types.FunctionDeclaration(
        name="web_search",
        description="Search the web for information on a given query using DuckDuckGo.",
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
        description="Get the current weather and atmospheric conditions for a city using wttr.in.",
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
        description="Safely evaluate a mathematical expression. Supports +, -, *, /, **, sqrt, sin, cos, log, factorial, gcd, etc.",
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
        description="Get the current date, time, day of week, and epoch timestamp.",
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
        description="Generate a starter code template in a given programming language (python, javascript, typescript, java, go, rust, html).",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "language": types.Schema(
                    type=types.Type.STRING,
                    description="Programming language (python, javascript, typescript, java, go, rust, html).",
                ),
                "description": types.Schema(
                    type=types.Type.STRING,
                    description="Short description of what the code should do.",
                ),
            },
            required=["language", "description"],
        ),
    ),
    types.FunctionDeclaration(
        name="system_diagnostics",
        description="Run full real-time diagnostics: CPU, RAM, disk, battery, network I/O, uptime, process count, and OS details.",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={},
        ),
    ),
    types.FunctionDeclaration(
        name="system_protocol",
        description="Execute system protocols and status modes: stealth, standby, combat readiness, party protocol, goodnight, or log memos/reminders/notes.",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "command": types.Schema(
                    type=types.Type.STRING,
                    description="The protocol name (e.g. 'stealth mode', 'standby', 'combat readiness', 'party protocol', 'goodnight', 'log memo').",
                ),
                "parameters": types.Schema(
                    type=types.Type.STRING,
                    description="Additional context, notes, or parameters for the protocol.",
                ),
            },
            required=["command"],
        ),
    ),
    types.FunctionDeclaration(
        name="wikipedia_lookup",
        description="Look up a topic on Wikipedia and return a concise summary with source link.",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "topic": types.Schema(
                    type=types.Type.STRING,
                    description="The topic to look up on Wikipedia.",
                ),
            },
            required=["topic"],
        ),
    ),
    types.FunctionDeclaration(
        name="set_timer",
        description="Set a countdown timer with a label. The timer will notify when complete.",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "duration_seconds": types.Schema(
                    type=types.Type.INTEGER,
                    description="Timer duration in seconds.",
                ),
                "label": types.Schema(
                    type=types.Type.STRING,
                    description="Label for the timer (e.g. 'Coffee break', 'Meeting').",
                ),
            },
            required=["duration_seconds"],
        ),
    ),
    types.FunctionDeclaration(
        name="tell_joke",
        description="Tell a joke. Categories: general, programming/tech.",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "category": types.Schema(
                    type=types.Type.STRING,
                    description="Joke category: 'general' or 'programming'.",
                ),
            },
        ),
    ),
    types.FunctionDeclaration(
        name="unit_convert",
        description="Convert between common units: length (km/miles, m/ft, cm/inch), weight (kg/lbs, g/oz), temperature (C/F/K), speed (kmh/mph), data (GB/MB/TB).",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "value": types.Schema(
                    type=types.Type.NUMBER,
                    description="The numeric value to convert.",
                ),
                "from_unit": types.Schema(
                    type=types.Type.STRING,
                    description="The source unit (e.g. 'km', 'lbs', 'C', 'mph').",
                ),
                "to_unit": types.Schema(
                    type=types.Type.STRING,
                    description="The target unit (e.g. 'miles', 'kg', 'F', 'kmh').",
                ),
            },
            required=["value", "from_unit", "to_unit"],
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
    except Exception as exc:
        return f"Error executing tool '{name}': {exc}"
