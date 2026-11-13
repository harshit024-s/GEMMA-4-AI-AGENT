# 🤖 J.A.R.V.I.S. — Gemma 4 Tactical AI

> *"At your service, sir."* — An Iron Man-inspired AI assistant powered by Google's Gemma 4 architecture.

![License](https://img.shields.io/badge/license-Apache%202.0-blue)
![Python](https://img.shields.io/badge/python-3.10+-green)
![Gemma](https://img.shields.io/badge/model-Gemma%204%20MoE-purple)

---

## ✨ Features

### 🧠 Agentic AI Core
- **Multi-turn tool calling** — autonomous agentic loop with up to 10 tool rounds per message
- **12 built-in tools** — system diagnostics, weather, Wikipedia, timers, jokes, unit conversion, code generation, and more
- **Streaming SSE** — real-time token streaming with Server-Sent Events
- **Deep Thinking mode** — toggle reasoning/chain-of-thought display

### 🎙️ Voice Interface (Speech-to-Speech)
- **Speech-to-Text** — click the mic or press `Ctrl+M` to speak
- **Text-to-Speech** — J.A.R.V.I.S. speaks responses in a British English voice
- **Continuous Listen Mode** — auto-listens after speaking for hands-free conversation
- **Sound FX** — sci-fi chimes for tool calls, completions, errors, and timer alarms

### 🎨 Iron Man HUD UI
- **Arc Reactor** welcome screen with animated rings and interactive states
- **Floating particle network** — interconnected particles with dynamic connections
- **Holographic grid** overlay with scanline effects
- **Dark theme** with cyan/gold accent palette inspired by the Stark Industries HUD
- **Audio equalizer** visualizer during speech synthesis
- **Live clock** and session message counter
- **Active timer** progress bars in the sidebar
- **Keyboard shortcuts** panel with quick-reference guide
- **Mobile responsive** with slide-out sidebar

### 🛠️ 12 Tactical Tools

| Tool | Description |
|------|-------------|
| `system_diagnostics` | Full CPU, RAM, disk, battery, network I/O, uptime, and process telemetry |
| `system_protocol` | Stealth, standby, combat, party, goodnight modes + memo logging |
| `web_search` | Web intelligence via DuckDuckGo Instant Answer API |
| `get_weather` | Live atmospheric conditions from wttr.in |
| `calculate` | AST-based safe math evaluator (trig, log, factorial, gcd) |
| `get_current_datetime` | Date, time, epoch timestamp |
| `get_news_headlines` | Topic-based intelligence briefings |
| `generate_code` | Code templates in Python, JS, TS, Java, Go, Rust, HTML |
| `wikipedia_lookup` | Knowledge base queries from Wikipedia REST API |
| `set_timer` | Countdown timers with live progress bars |
| `tell_joke` | Jokes from JokeAPI (programming or general) |
| `unit_convert` | Length, weight, temperature, speed, data conversions |

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

### Setup

```bash
# Clone the repo
git clone https://github.com/harshit024-s/GEMMA-4-AI-AGENT.git
cd GEMMA-4-AI-AGENT

# Create virtual environment
python -m venv .venv

# Activate it
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Set your API key
echo "GEMINI_API_KEY=your_key_here" > .env

# Run!
python run.py
```

Open **http://localhost:8000** in your browser.

### ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+M` | Toggle microphone |
| `Ctrl+Shift+R` | Reset session |
| `Esc` | Stop speaking |
| `Enter` | Send message |
| `Shift+Enter` | New line |

---

## 🏗️ Architecture

```
gemma4-agent/
├── backend/
│   ├── __init__.py         # Package marker
│   ├── agent.py            # Agentic loop with tool calling
│   ├── config.py           # Environment config & system prompt
│   ├── main.py             # FastAPI server with SSE streaming
│   ├── tools.py            # 12 tool implementations + schemas
│   └── requirements.txt    # Python dependencies
├── frontend/
│   ├── index.html          # HUD interface with Arc Reactor
│   ├── styles.css          # Iron Man dark theme (1000+ lines)
│   └── app.js              # Audio, voice, particles, timers
├── .env                    # API key (not committed)
├── .env.example            # Template
├── run.py                  # Entry point
├── render.yaml             # 1-click Render deployment
├── LICENSE                 # Apache 2.0
└── README.md               # This file
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/chat` | Non-streaming chat |
| `POST` | `/api/chat/stream` | Streaming chat (SSE) |
| `GET` | `/api/tools` | List available tools |
| `POST` | `/api/reset` | Clear conversation |
| `GET` | `/api/history` | Get conversation log |
| `GET` | `/api/status` | Agent status & model info |

---

## 🌐 Deploy to Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/harshit024-s/GEMMA-4-AI-AGENT)

Set the `GEMINI_API_KEY` environment variable in Render's dashboard.

---

## 📄 License

Apache 2.0 — see [LICENSE](LICENSE)

---

## 🙏 Credits

- **Google Gemma 4** — Core AI model
- **FastAPI** — Backend framework
- **Web Speech API** — Browser-native STT/TTS
- **Iron Man / Marvel** — UI inspiration
- Built with ❤️ by [@harshit024-s](https://github.com/harshit024-s)
