/* ═══════════════════════════════════════════════════════════════════════════
   J.A.R.V.I.S. Tactical Core v3 – Frontend Logic, Audio, Particles & Timers
   ═══════════════════════════════════════════════════════════════════════════ */

(() => {
  "use strict";

  // ── DOM References ────────────────────────────────────────────────────────
  const chatMessages     = document.getElementById("chat-messages");
  const messageInput     = document.getElementById("message-input");
  const sendBtn          = document.getElementById("send-btn");
  const micBtn           = document.getElementById("mic-btn");
  const toolsList        = document.getElementById("tools-list");
  const newChatBtn       = document.getElementById("new-chat-btn");
  const welcomeScreen    = document.getElementById("welcome-screen");
  const arcReactor       = document.getElementById("arc-reactor");
  const reactorStatusMsg = document.getElementById("reactor-status-msg");
  const hudStatusText    = document.getElementById("hud-status-text");
  const audioVisualizer  = document.getElementById("audio-visualizer");
  const voiceMuteBtn     = document.getElementById("voice-mute-btn");
  const speakerIcon      = document.getElementById("speaker-icon");
  const voiceToggle      = document.getElementById("voice-toggle");
  const ttsStatusBadge   = document.getElementById("tts-status");
  const thinkingToggle   = document.getElementById("thinking-toggle");
  const streamToggle     = document.getElementById("stream-toggle");
  const continuousToggle = document.getElementById("continuous-listen-toggle");
  const sidebarToggle    = document.getElementById("sidebar-toggle");
  const sidebar          = document.getElementById("sidebar");
  const liveClock        = document.getElementById("live-clock");
  const msgCounter       = document.getElementById("msg-counter");
  const timersSection    = document.getElementById("timers-section");
  const timersList       = document.getElementById("timers-list");
  const particleCanvas   = document.getElementById("particle-canvas");

  const API_BASE = "";

  // ── State ─────────────────────────────────────────────────────────────────
  let voiceEnabled = true;
  let isListening = false;
  let recognition = null;
  let audioCtx = null;
  let messageCount = 0;
  let activeTimers = [];
  let sending = false;

  // ═══════════════════════════════════════════════════════════════════════════
  //  Particle System (Floating HUD particles)
  // ═══════════════════════════════════════════════════════════════════════════
  function initParticles() {
    if (!particleCanvas) return;
    const ctx = particleCanvas.getContext("2d");
    let width, height;
    const particles = [];
    const PARTICLE_COUNT = 40;

    function resize() {
      width = particleCanvas.width = window.innerWidth;
      height = particleCanvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    class Particle {
      constructor() { this.reset(); }
      reset() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.3;
        this.vy = (Math.random() - 0.5) * 0.3;
        this.radius = Math.random() * 1.5 + 0.5;
        this.alpha = Math.random() * 0.4 + 0.1;
        this.pulse = Math.random() * Math.PI * 2;
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.pulse += 0.02;
        if (this.x < 0 || this.x > width) this.vx *= -1;
        if (this.y < 0 || this.y > height) this.vy *= -1;
      }
      draw() {
        const a = this.alpha * (0.5 + 0.5 * Math.sin(this.pulse));
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 240, 255, ${a})`;
        ctx.fill();
      }
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(new Particle());

    // Draw lines between close particles
    function drawConnections() {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            const alpha = (1 - dist / 150) * 0.08;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(0, 240, 255, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
    }

    function animate() {
      ctx.clearRect(0, 0, width, height);
      particles.forEach(p => { p.update(); p.draw(); });
      drawConnections();
      requestAnimationFrame(animate);
    }
    animate();
  }
  initParticles();

  // ═══════════════════════════════════════════════════════════════════════════
  //  Live Clock
  // ═══════════════════════════════════════════════════════════════════════════
  function updateClock() {
    if (!liveClock) return;
    const now = new Date();
    liveClock.textContent = now.toLocaleTimeString("en-GB", { hour12: false });
  }
  updateClock();
  setInterval(updateClock, 1000);

  // ═══════════════════════════════════════════════════════════════════════════
  //  Web Audio Synthesizer (Sci-Fi Sound FX)
  // ═══════════════════════════════════════════════════════════════════════════
  function initAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  }

  function playChime(type) {
    try {
      initAudioContext();
      if (!audioCtx) return;
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === "activate") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now); osc.stop(now + 0.25);
      } else if (type === "tool") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(1046.5, now);
        osc.frequency.exponentialRampToValueAtTime(1318.5, now + 0.08);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now); osc.stop(now + 0.15);
      } else if (type === "complete") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.08);
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now); osc.stop(now + 0.3);
      } else if (type === "timer") {
        // Urgent alarm chime — three quick notes
        osc.type = "square";
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(1100, now + 0.1);
        osc.frequency.setValueAtTime(880, now + 0.2);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.start(now); osc.stop(now + 0.5);
      } else if (type === "error") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.3);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now); osc.stop(now + 0.4);
      }
    } catch { /* Audio autoplay policy fallback */ }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Text-to-Speech (JARVIS Voice Synthesis)
  // ═══════════════════════════════════════════════════════════════════════════
  function speak(text) {
    if (!voiceEnabled || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();

    let cleanText = text
      .replace(/```[\s\S]*?```/g, "Code block generated on terminal, sir.")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/[#*_~>]/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\n+/g, " ")
      .replace(/_TIMER_DATA_:.*$/gm, "")
      .trim();

    if (!cleanText) return;

    // Truncate very long responses for TTS (keep under 500 chars)
    if (cleanText.length > 500) {
      cleanText = cleanText.substring(0, 497) + "... End of briefing, sir.";
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.02;
    utterance.pitch = 0.94;

    const voices = window.speechSynthesis.getVoices();
    const jarvisVoice = voices.find(v =>
      v.lang.startsWith("en-GB") && (v.name.includes("Male") || v.name.includes("George") || v.name.includes("Oliver"))
    ) || voices.find(v => v.lang.startsWith("en-GB"))
      || voices.find(v => v.name.includes("Google UK English Male"))
      || voices.find(v => v.lang.startsWith("en"));

    if (jarvisVoice) utterance.voice = jarvisVoice;

    utterance.onstart = () => {
      setReactorState("speaking");
      audioVisualizer.classList.add("active");
      hudStatusText.textContent = "VOCALIZING RESPONSE, SIR...";
    };

    utterance.onend = () => {
      setReactorState("idle");
      audioVisualizer.classList.remove("active");
      hudStatusText.textContent = "SYSTEMS NOMINAL • ONLINE";
      // If continuous listen mode is on, start listening again after speaking
      if (continuousToggle && continuousToggle.checked && !sending) {
        setTimeout(() => startListening(), 400);
      }
    };

    utterance.onerror = () => {
      setReactorState("idle");
      audioVisualizer.classList.remove("active");
      hudStatusText.textContent = "SYSTEMS NOMINAL • ONLINE";
    };

    window.speechSynthesis.speak(utterance);
  }

  if ("speechSynthesis" in window) {
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Speech-to-Text (Voice Recognition)
  // ═══════════════════════════════════════════════════════════════════════════
  function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (micBtn) micBtn.style.display = "none";
      console.warn("Speech recognition not supported.");
      return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      isListening = true;
      if (micBtn) micBtn.classList.add("listening");
      setReactorState("listening");
      playChime("activate");
      hudStatusText.textContent = "AURAL SENSORS ACTIVE • LISTENING...";
      if (reactorStatusMsg) reactorStatusMsg.textContent = "Listening to your directive, sir...";
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      messageInput.value = transcript;
      messageInput.dispatchEvent(new Event("input"));
      sendMessage();
    };

    recognition.onerror = (event) => {
      console.warn("Speech recognition notice:", event.error);
      stopListening();
    };

    recognition.onend = () => {
      stopListening();
    };
  }

  function startListening() {
    if (!recognition) return;
    try {
      window.speechSynthesis.cancel();
      recognition.start();
    } catch {
      stopListening();
    }
  }

  function stopListening() {
    isListening = false;
    if (micBtn) micBtn.classList.remove("listening");
    setReactorState("idle");
    hudStatusText.textContent = "SYSTEMS NOMINAL • ONLINE";
    if (reactorStatusMsg) reactorStatusMsg.textContent = "At your service, sir. How may I assist you today?";
  }

  if (micBtn) {
    micBtn.addEventListener("click", () => {
      initAudioContext();
      if (isListening) {
        if (recognition) recognition.stop();
        stopListening();
      } else {
        startListening();
      }
    });
  }

  initSpeechRecognition();

  // ── Arc Reactor States ────────────────────────────────────────────────────
  function setReactorState(state) {
    if (!arcReactor) return;
    arcReactor.classList.remove("listening", "processing", "speaking");
    if (state !== "idle") arcReactor.classList.add(state);
  }

  // ── Audio Mute Controls ───────────────────────────────────────────────────
  function updateAudioControls(enabled) {
    voiceEnabled = enabled;
    if (voiceToggle) voiceToggle.checked = enabled;
    if (enabled) {
      speakerIcon.textContent = "🔊";
      ttsStatusBadge.textContent = "ONLINE";
      ttsStatusBadge.className = "telemetry-val text-green";
      playChime("activate");
    } else {
      speakerIcon.textContent = "🔇";
      ttsStatusBadge.textContent = "MUTED";
      ttsStatusBadge.className = "telemetry-val";
      window.speechSynthesis.cancel();
      audioVisualizer.classList.remove("active");
    }
    localStorage.setItem("jarvis_voice", enabled ? "1" : "0");
  }

  // Restore voice preference
  const savedVoice = localStorage.getItem("jarvis_voice");
  if (savedVoice === "0") updateAudioControls(false);

  voiceMuteBtn.addEventListener("click", () => updateAudioControls(!voiceEnabled));
  voiceToggle.addEventListener("change", (e) => updateAudioControls(e.target.checked));

  // ═══════════════════════════════════════════════════════════════════════════
  //  Timer System
  // ═══════════════════════════════════════════════════════════════════════════
  function checkForTimerData(text) {
    const match = text.match(/_TIMER_DATA_:\s*(\{.*?\})/);
    if (!match) return;
    try {
      const data = JSON.parse(match[1]);
      if (data.seconds && data.seconds > 0) {
        startTimer(data.seconds, data.label || "Timer");
      }
    } catch { /* ignore parse errors */ }
  }

  function startTimer(seconds, label) {
    const timer = {
      id: Date.now(),
      label,
      totalSeconds: seconds,
      remaining: seconds,
      interval: null,
    };

    timer.interval = setInterval(() => {
      timer.remaining--;
      renderTimers();
      if (timer.remaining <= 0) {
        clearInterval(timer.interval);
        activeTimers = activeTimers.filter(t => t.id !== timer.id);
        renderTimers();
        playChime("timer");
        // Announce timer completion
        appendMessage("agent", `**⏱️ Timer Complete:** "${label}" has finished, sir!`);
        speak(`Timer ${label} has completed, sir.`);
      }
    }, 1000);

    activeTimers.push(timer);
    renderTimers();
  }

  function renderTimers() {
    if (!timersList || !timersSection) return;
    if (activeTimers.length === 0) {
      timersSection.style.display = "none";
      return;
    }
    timersSection.style.display = "block";
    timersList.innerHTML = activeTimers.map(t => {
      const mins = Math.floor(t.remaining / 60);
      const secs = t.remaining % 60;
      const pct = ((t.totalSeconds - t.remaining) / t.totalSeconds * 100).toFixed(0);
      return `
        <div class="timer-item">
          <div class="timer-label">${escapeHtml(t.label)}</div>
          <div class="timer-bar-bg">
            <div class="timer-bar-fill" style="width:${pct}%"></div>
          </div>
          <div class="timer-time">${mins}:${String(secs).padStart(2, '0')}</div>
        </div>`;
    }).join("");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Load Tools Registry
  // ═══════════════════════════════════════════════════════════════════════════
  async function loadTools() {
    try {
      const res  = await fetch(`${API_BASE}/api/tools`);
      const data = await res.json();
      toolsList.innerHTML = "";
      const icons = {
        web_search:           "🌐",
        get_weather:          "🌦️",
        calculate:            "🧮",
        get_current_datetime: "⏱️",
        get_news_headlines:   "📡",
        generate_code:        "💻",
        system_diagnostics:   "⚡",
        system_protocol:      "🛡️",
        wikipedia_lookup:     "📚",
        set_timer:            "⏳",
        tell_joke:            "😄",
        unit_convert:         "🔄",
      };
      data.forEach((t) => {
        const li = document.createElement("li");
        li.className = "tool-item";
        li.innerHTML = `
          <div class="tool-name">${icons[t.name] || "🔧"} ${t.name}</div>
          <div class="tool-desc">${t.description}</div>`;
        toolsList.appendChild(li);
      });
    } catch {
      toolsList.innerHTML = '<li class="tool-item"><div class="tool-desc">Tactical protocols standby. Start the server first.</div></li>';
    }
  }
  loadTools();

  // ── Auto-resize textarea ──────────────────────────────────────────────────
  messageInput.addEventListener("input", () => {
    messageInput.style.height = "auto";
    messageInput.style.height = Math.min(messageInput.scrollHeight, 160) + "px";
    sendBtn.disabled = !messageInput.value.trim();
  });

  // ── Keyboard shortcut (Enter to send) ─────────────────────────────────────
  messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (messageInput.value.trim()) sendMessage();
    }
  });

  sendBtn.addEventListener("click", () => {
    if (messageInput.value.trim()) sendMessage();
  });

  // ── Global Keyboard Shortcuts ─────────────────────────────────────────────
  document.addEventListener("keydown", (e) => {
    // Ctrl+M — Toggle microphone
    if (e.ctrlKey && e.key === "m") {
      e.preventDefault();
      initAudioContext();
      if (isListening) {
        if (recognition) recognition.stop();
        stopListening();
      } else {
        startListening();
      }
    }
    // Ctrl+Shift+R — Reset session
    if (e.ctrlKey && e.shiftKey && e.key === "R") {
      e.preventDefault();
      newChatBtn.click();
    }
    // Escape — Stop TTS
    if (e.key === "Escape") {
      window.speechSynthesis.cancel();
      audioVisualizer.classList.remove("active");
      setReactorState("idle");
      hudStatusText.textContent = "SYSTEMS NOMINAL • ONLINE";
      if (isListening) {
        if (recognition) recognition.stop();
        stopListening();
      }
    }
  });

  // ── Sidebar mobile toggle ─────────────────────────────────────────────────
  sidebarToggle.addEventListener("click", () => sidebar.classList.toggle("open"));

  // ── Welcome chips ─────────────────────────────────────────────────────────
  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      initAudioContext();
      messageInput.value = chip.dataset.prompt;
      messageInput.dispatchEvent(new Event("input"));
      sendMessage();
    });
  });

  // ── Reset Session / New Chat ──────────────────────────────────────────────
  newChatBtn.addEventListener("click", async () => {
    initAudioContext();
    window.speechSynthesis.cancel();
    try { await fetch(`${API_BASE}/api/reset`, { method: "POST" }); } catch {}
    chatMessages.innerHTML = "";
    chatMessages.appendChild(welcomeScreen);
    welcomeScreen.classList.remove("hidden");
    setReactorState("idle");
    hudStatusText.textContent = "SYSTEMS NOMINAL • ONLINE";
    messageCount = 0;
    updateMsgCounter();
    // Clear timers
    activeTimers.forEach(t => clearInterval(t.interval));
    activeTimers = [];
    renderTimers();
  });

  function updateMsgCounter() {
    if (msgCounter) msgCounter.textContent = messageCount;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Send Directive / Message
  // ═══════════════════════════════════════════════════════════════════════════

  async function sendMessage() {
    if (sending) return;
    const text = messageInput.value.trim();
    if (!text) return;

    initAudioContext();
    sending = true;
    messageInput.value = "";
    messageInput.style.height = "auto";
    sendBtn.disabled = true;

    welcomeScreen.classList.add("hidden");

    appendMessage("user", text);
    messageCount++;
    updateMsgCounter();

    const useStreaming = streamToggle.checked;
    const useThinking = thinkingToggle.checked;

    setReactorState("processing");
    hudStatusText.textContent = "COMPUTING DIRECTIVE, SIR...";

    const typingEl = showTyping();

    try {
      if (useStreaming) {
        await handleStream(text, useThinking, typingEl);
      } else {
        await handleNonStream(text, useThinking, typingEl);
      }
    } catch (err) {
      removeTyping(typingEl);
      setReactorState("idle");
      hudStatusText.textContent = "SYSTEMS NOMINAL • ONLINE";
      appendMessage("agent", `**Tactical Variance:** ${err.message}`);
      playChime("error");
    }

    messageCount++;
    updateMsgCounter();
    sending = false;
  }

  // ── Non-streaming ─────────────────────────────────────────────────────────
  async function handleNonStream(text, thinking, typingEl) {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, thinking }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `HTTP ${res.status}`);
    }

    const data = await res.json();
    removeTyping(typingEl);

    if (data.tool_calls && data.tool_calls.length) {
      playChime("tool");
      data.tool_calls.forEach((tc) => appendToolCall(tc.name, tc.args, tc.result));
    }

    if (data.thinking) appendThinking(data.thinking);

    appendMessage("agent", data.response);
    playChime("complete");
    setReactorState("idle");
    hudStatusText.textContent = "SYSTEMS NOMINAL • ONLINE";

    // Check for timer data in tool results
    if (data.tool_calls) {
      data.tool_calls.forEach(tc => checkForTimerData(tc.result));
    }

    speak(data.response);
  }

  // ── Streaming (SSE) ───────────────────────────────────────────────────────
  async function handleStream(text, thinking, typingEl) {
    const res = await fetch(`${API_BASE}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, thinking }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let messageEl = null;
    let removedTyping = false;
    let fullText = "";
    let toolResults = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (!raw) continue;

        let event;
        try { event = JSON.parse(raw); } catch { continue; }

        switch (event.type) {
          case "thinking":
            if (!removedTyping) { removeTyping(typingEl); removedTyping = true; }
            appendThinking(event.content);
            break;

          case "tool_call":
            if (!removedTyping) { removeTyping(typingEl); removedTyping = true; }
            playChime("tool");
            appendToolCall(event.name, event.args, null);
            break;

          case "tool_result": {
            const cards = chatMessages.querySelectorAll(".tool-call-card");
            if (cards.length) {
              const last = cards[cards.length - 1];
              const icon = last.querySelector(".tool-call-icon");
              if (icon) { icon.classList.remove("calling"); icon.classList.add("done"); icon.textContent = "✓"; }
              const body = last.querySelector(".tool-call-body");
              if (body && event.result) {
                const sec = document.createElement("div");
                sec.className = "tool-call-section";
                sec.innerHTML = `<div class="tool-call-section-label">Telemetry Result</div><div class="tool-call-json">${escapeHtml(event.result)}</div>`;
                body.appendChild(sec);
              }
            }
            if (event.result) {
              toolResults.push(event.result);
              checkForTimerData(event.result);
            }
            break;
          }

          case "text":
            if (!removedTyping) { removeTyping(typingEl); removedTyping = true; }
            if (!messageEl) {
              messageEl = appendMessage("agent", "");
            }
            fullText = event.content;
            const bubble = messageEl.querySelector(".message-bubble");
            if (bubble) {
              bubble.innerHTML = renderMarkdown(event.content);
            }
            break;

          case "error":
            if (!removedTyping) { removeTyping(typingEl); removedTyping = true; }
            appendMessage("agent", `**Tactical Variance:** ${event.content}`);
            playChime("error");
            break;

          case "done":
            break;
        }
      }
    }

    if (!removedTyping) removeTyping(typingEl);
    playChime("complete");

    if (fullText) {
      speak(fullText);
    } else {
      setReactorState("idle");
      hudStatusText.textContent = "SYSTEMS NOMINAL • ONLINE";
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  UI Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  function appendMessage(role, text) {
    const row = document.createElement("div");
    row.className = `message-row ${role}`;

    const time = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

    const avatarHTML = role === "user"
      ? "SIR"
      : `<div class="mini-arc-reactor" style="width:24px;height:24px;">
           <div class="core-dot" style="width:6px;height:6px;"></div>
         </div>`;

    row.innerHTML = `
      <div class="avatar ${role}-avatar">${avatarHTML}</div>
      <div class="message-content">
        <div class="message-bubble">${role === "user" ? escapeHtml(text) : renderMarkdown(text)}</div>
        <div class="message-time">${time}</div>
      </div>`;

    chatMessages.appendChild(row);
    scrollToBottom();
    return row;
  }

  function appendToolCall(name, args, result) {
    const card = document.createElement("div");
    card.className = "tool-call-card";

    const statusIcon = result === null ? "calling" : "done";
    const statusChar = result === null ? "⚡" : "✓";

    let bodyHTML = `
      <div class="tool-call-section">
        <div class="tool-call-section-label">Parameters</div>
        <div class="tool-call-json">${escapeHtml(JSON.stringify(args, null, 2))}</div>
      </div>`;

    if (result !== null) {
      bodyHTML += `
        <div class="tool-call-section">
          <div class="tool-call-section-label">Telemetry Result</div>
          <div class="tool-call-json">${escapeHtml(result)}</div>
        </div>`;
    }

    card.innerHTML = `
      <div class="tool-call-header">
        <div class="tool-call-icon ${statusIcon}">${statusChar}</div>
        <div class="tool-call-name">PROTOCOL: ${escapeHtml(name.toUpperCase())}</div>
        <div class="tool-call-chevron">▼</div>
      </div>
      <div class="tool-call-body">${bodyHTML}</div>`;

    card.querySelector(".tool-call-header").addEventListener("click", () => {
      card.classList.toggle("open");
    });

    const wrapper = document.createElement("div");
    wrapper.className = "message-row agent";
    wrapper.style.paddingLeft = "50px";
    wrapper.appendChild(card);
    chatMessages.appendChild(wrapper);
    scrollToBottom();
  }

  function appendThinking(text) {
    const block = document.createElement("div");
    block.className = "message-row agent";
    block.style.paddingLeft = "50px";
    block.innerHTML = `
      <div class="thinking-block">
        <div class="thinking-label">⚡ Neural Deliberation Protocol</div>
        ${escapeHtml(text)}
      </div>`;
    chatMessages.appendChild(block);
    scrollToBottom();
  }

  function showTyping() {
    const el = document.createElement("div");
    el.className = "typing-indicator";
    el.innerHTML = `
      <div class="avatar agent-avatar">
        <div class="mini-arc-reactor" style="width:24px;height:24px;">
          <div class="core-dot" style="width:6px;height:6px;"></div>
        </div>
      </div>
      <div class="typing-bubbles">
        <span></span><span></span><span></span>
      </div>`;
    chatMessages.appendChild(el);
    scrollToBottom();
    return el;
  }

  function removeTyping(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Markdown Renderer
  // ═══════════════════════════════════════════════════════════════════════════
  function renderMarkdown(md) {
    if (!md) return "";
    let html = escapeHtml(md);

    const codeBlocks = [];
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const idx = codeBlocks.length;
      codeBlocks.push(`<pre><code class="language-${lang}">${code.trim()}</code></pre>`);
      return `@@CODEBLOCK_${idx}@@`;
    });

    const inlineCodes = [];
    html = html.replace(/`([^`]+)`/g, (_, code) => {
      const idx = inlineCodes.length;
      inlineCodes.push(`<code>${code}</code>`);
      return `@@INLINECODE_${idx}@@`;
    });

    html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
    html = html.replace(/^## (.+)$/gm,  "<h2>$1</h2>");
    html = html.replace(/^# (.+)$/gm,   "<h1>$1</h1>");

    html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
    html = html.replace(/\*\*(.+?)\*\*/g,     "<strong>$1</strong>");
    html = html.replace(/\*(.+?)\*/g,         "<em>$1</em>");

    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    html = html.replace(/^- (.+)$/gm, '<li class="ul-item">$1</li>');
    html = html.replace(/(<li class="ul-item">.*<\/li>\n?)+/g, (m) => `<ul>${m.replace(/ class="ul-item"/g, "")}</ul>`);

    html = html.replace(/^\d+\. (.+)$/gm, '<li class="ol-item">$1</li>');
    html = html.replace(/(<li class="ol-item">.*<\/li>\n?)+/g, (m) => `<ol>${m.replace(/ class="ol-item"/g, "")}</ol>`);

    html = html.replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>");
    html = html.replace(/^---$/gm, "<hr>");

    html = html.replace(/\n\n/g, "</p><p>");
    html = `<p>${html}</p>`;

    html = html.replace(/<p>\s*<\/p>/g, "");
    html = html.replace(/<p>(<(?:h[1-6]|pre|ul|ol|blockquote|hr|li)[^>]*>)/g, "$1");
    html = html.replace(/(<\/(?:h[1-6]|pre|ul|ol|blockquote|hr|li)>)<\/p>/g, "$1");
    html = html.replace(/\n/g, "<br>");

    html = html.replace(/@@INLINECODE_(\d+)@@/g, (_, idx) => inlineCodes[Number(idx)]);
    html = html.replace(/@@CODEBLOCK_(\d+)@@/g, (_, idx) => `</p>${codeBlocks[Number(idx)]}<p>`);
    html = html.replace(/<p>\s*<\/p>/g, "");

    return html;
  }

  function escapeHtml(s) {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return String(s).replace(/[&<>"']/g, (c) => map[c]);
  }

  // ── Fetch status on load ──────────────────────────────────────────────────
  (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/status`);
      const data = await res.json();
      if (data.model) {
        const badge = document.getElementById("model-badge");
        if (badge) badge.textContent = data.model;
      }
    } catch { /* server not running yet */ }
  })();

})();
