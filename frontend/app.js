/* ═══════════════════════════════════════════════════════════════════════════
   AURA — Next-Gen AI Companion Logic
   - Living 3D-Like Fluid Undulating Sine Ribbon (matching reference image)
   - Dynamic Task Execution Tracker & Slide-Over Drawer
   - Natural Voice Synthesis (Nova, Aura, Atlas, Sol) & Speech Recognition
   ═══════════════════════════════════════════════════════════════════════════ */

(() => {
  "use strict";

  // ── DOM References ────────────────────────────────────────────────────────
  const waveCanvas        = document.getElementById("wave-canvas");
  const chatStream        = document.getElementById("chat-stream");
  const heroScreen        = document.getElementById("hero-screen");
  const messageInput      = document.getElementById("message-input");
  const sendBtn           = document.getElementById("send-btn");
  const micBtn            = document.getElementById("mic-btn");
  const resetBtn          = document.getElementById("reset-btn");
  const taskStatusPill    = document.getElementById("task-status-pill");
  const taskStatusText    = document.getElementById("task-status-text");
  const taskBadge         = document.getElementById("task-badge");
  const tasksToggleBtn    = document.getElementById("tasks-toggle-btn");
  const taskDrawer        = document.getElementById("task-drawer");
  const closeDrawerBtn    = document.getElementById("close-drawer-btn");
  const drawerBackdrop    = document.getElementById("drawer-backdrop");
  const taskTimeline      = document.getElementById("task-timeline");
  const drawerEmpty       = document.getElementById("drawer-empty");
  const voiceMenuBtn      = document.getElementById("voice-menu-btn");
  const voiceDropdown     = document.getElementById("voice-dropdown");
  const currentVoiceName  = document.getElementById("current-voice-name");
  const voiceOptions      = document.querySelectorAll(".voice-opt");
  const voiceSpeechToggle = document.getElementById("voice-speech-toggle");
  const continuousMicToggle = document.getElementById("continuous-mic-toggle");

  const API_BASE = "";

  // ── State ─────────────────────────────────────────────────────────────────
  let isListening = false;
  let recognition = null;
  let audioCtx = null;
  let sending = false;
  let performedTasks = [];

  // Wave Visualizer Mode: "ambient" | "listening" | "processing" | "speaking"
  let waveState = "ambient";
  let voiceActivityLevel = 0; // 0 to 1

  // Voice Persona Settings
  let selectedPersona = localStorage.getItem("aura_persona") || "nova";
  let ttsEnabled = localStorage.getItem("aura_tts") !== "0";

  // ═══════════════════════════════════════════════════════════════════════════
  //  Living 3D Ethereal Fluid Wave Ribbon (Matches Screenshot)
  // ═══════════════════════════════════════════════════════════════════════════
  function initWaveCanvas() {
    if (!waveCanvas) return;
    const ctx = waveCanvas.getContext("2d");
    let width, height;

    function resize() {
      width = waveCanvas.width = window.innerWidth;
      height = waveCanvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    let time = 0;

    // Multi-layer ribbon configs (layered ethereal glowing waves)
    const layers = [
      { color: "rgba(56, 92, 255, 0.28)",  speed: 0.012, amp: 26, freq: 0.0035, yOffset: 0.85, width: 2.5 },
      { color: "rgba(100, 60, 255, 0.32)", speed: 0.018, amp: 32, freq: 0.0042, yOffset: 0.85, width: 2.0 },
      { color: "rgba(0, 229, 255, 0.45)",  speed: 0.015, amp: 22, freq: 0.0050, yOffset: 0.85, width: 2.2 },
      { color: "rgba(139, 92, 246, 0.50)", speed: 0.022, amp: 38, freq: 0.0038, yOffset: 0.85, width: 1.8 },
      { color: "rgba(56, 189, 248, 0.70)", speed: 0.025, amp: 18, freq: 0.0062, yOffset: 0.85, width: 3.0 },
      { color: "rgba(255, 255, 255, 0.85)", speed: 0.028, amp: 14, freq: 0.0075, yOffset: 0.85, width: 1.2 },
    ];

    function renderWave() {
      ctx.clearRect(0, 0, width, height);

      // Global composite for luminous optical blending
      ctx.globalCompositeOperation = "screen";

      time += 1;

      // Adjust wave dynamic multipliers based on assistant state
      let stateAmpMult = 1.0;
      let stateSpeedMult = 1.0;

      if (waveState === "listening") {
        stateAmpMult = 2.4 + Math.random() * 0.8;
        stateSpeedMult = 2.0;
      } else if (waveState === "processing") {
        stateAmpMult = 1.8 + Math.sin(time * 0.08) * 0.6;
        stateSpeedMult = 2.5;
      } else if (waveState === "speaking") {
        stateAmpMult = 2.8 + Math.sin(time * 0.12) * 1.2;
        stateSpeedMult = 1.8;
      }

      const centerY = height * 0.86;

      layers.forEach((layer, idx) => {
        ctx.beginPath();
        const currentSpeed = layer.speed * stateSpeedMult;
        const currentAmp = layer.amp * stateAmpMult;

        ctx.strokeStyle = layer.color;
        ctx.lineWidth = layer.width;
        ctx.shadowBlur = 18;
        ctx.shadowColor = layer.color;

        const points = [];
        const step = 6;

        for (let x = 0; x <= width; x += step) {
          // Windowing function so waves taper elegantly towards the screen edges
          const edgeDist = Math.sin((x / width) * Math.PI);
          const envelope = Math.pow(edgeDist, 1.6);

          // Combined sine waves for organic fluid silk ribbon shape
          const w1 = Math.sin(x * layer.freq + time * currentSpeed);
          const w2 = Math.cos(x * (layer.freq * 1.5) - time * (currentSpeed * 0.8));
          const w3 = Math.sin(x * (layer.freq * 0.5) + time * (currentSpeed * 1.3));

          const y = centerY + (w1 * 0.6 + w2 * 0.3 + w3 * 0.2) * currentAmp * envelope;

          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      });

      // Reset shadow blur
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = "source-over";

      requestAnimationFrame(renderWave);
    }

    renderWave();
  }

  initWaveCanvas();

  // ═══════════════════════════════════════════════════════════════════════════
  //  Voice Synthesis & Personas (Nova, Aura, Atlas, Sol)
  // ═══════════════════════════════════════════════════════════════════════════
  function initAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  }

  function playSound(type) {
    try {
      initAudioContext();
      if (!audioCtx) return;
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === "start") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now); osc.stop(now + 0.22);
      } else if (type === "task") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1174, now + 0.1);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        osc.start(now); osc.stop(now + 0.16);
      } else if (type === "done") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.setValueAtTime(880, now + 0.1);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.start(now); osc.stop(now + 0.28);
      }
    } catch { /* autoplay policy fallback */ }
  }

  function getPersonaVoice() {
    if (!("speechSynthesis" in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    if (selectedPersona === "atlas") {
      // Deep male voice
      return voices.find(v => (v.name.includes("Male") || v.name.includes("David") || v.name.includes("Mark") || v.name.includes("George")) && v.lang.startsWith("en"))
        || voices.find(v => v.lang.startsWith("en"));
    } else if (selectedPersona === "aura") {
      // Soft gentle female voice
      return voices.find(v => (v.name.includes("Zira") || v.name.includes("Victoria") || v.name.includes("Natural")) && v.lang.startsWith("en"))
        || voices.find(v => v.lang.startsWith("en"));
    } else if (selectedPersona === "sol") {
      // Warm conversational voice
      return voices.find(v => v.name.includes("Google") && v.lang.startsWith("en"))
        || voices.find(v => v.lang.startsWith("en"));
    } else {
      // "nova" (default): Smooth natural female voice
      return voices.find(v => (v.name.includes("Samantha") || v.name.includes("Jenny") || v.name.includes("Google UK English Female") || v.name.includes("Female")) && v.lang.startsWith("en"))
        || voices.find(v => v.lang.startsWith("en"));
    }
  }

  function speak(text) {
    if (!ttsEnabled || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();

    let clean = text
      .replace(/```[\s\S]*?```/g, "Code block provided on screen.")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/[#*_~>]/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\n+/g, " ")
      .trim();

    if (!clean) return;

    if (clean.length > 450) {
      clean = clean.substring(0, 440) + "... and more details are shown above.";
    }

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.voice = getPersonaVoice();

    // Fine-tune rate & pitch according to persona
    if (selectedPersona === "atlas") {
      utterance.pitch = 0.88;
      utterance.rate = 0.98;
    } else if (selectedPersona === "aura") {
      utterance.pitch = 1.05;
      utterance.rate = 0.95;
    } else {
      utterance.pitch = 1.0;
      utterance.rate = 1.02;
    }

    utterance.onstart = () => {
      waveState = "speaking";
    };

    utterance.onend = () => {
      waveState = "ambient";
      if (continuousMicToggle && continuousMicToggle.checked && !sending) {
        setTimeout(startListening, 400);
      }
    };

    utterance.onerror = () => {
      waveState = "ambient";
    };

    window.speechSynthesis.speak(utterance);
  }

  if ("speechSynthesis" in window) {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Speech-to-Text (Microphone)
  // ═══════════════════════════════════════════════════════════════════════════
  function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (micBtn) micBtn.style.display = "none";
      return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      isListening = true;
      if (micBtn) micBtn.classList.add("listening");
      waveState = "listening";
      playSound("start");
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      messageInput.value = transcript;
      messageInput.dispatchEvent(new Event("input"));
      sendMessage();
    };

    recognition.onerror = () => {
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
    if (waveState === "listening") waveState = "ambient";
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

  // ═══════════════════════════════════════════════════════════════════════════
  //  Voice Settings Dropdown & Controls
  // ═══════════════════════════════════════════════════════════════════════════
  function updatePersona(name) {
    selectedPersona = name;
    localStorage.setItem("aura_persona", name);
    currentVoiceName.textContent = name.charAt(0).toUpperCase() + name.slice(1);

    voiceOptions.forEach(opt => {
      opt.classList.toggle("active", opt.dataset.voice === name);
    });
  }

  updatePersona(selectedPersona);

  voiceOptions.forEach(opt => {
    opt.addEventListener("click", () => {
      updatePersona(opt.dataset.voice);
      voiceDropdown.classList.add("hidden");
      playSound("done");
      speak(`Hello, I am ${opt.dataset.voice}. How may I help you today?`);
    });
  });

  voiceMenuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    voiceDropdown.classList.toggle("hidden");
  });

  document.addEventListener("click", (e) => {
    if (!voiceDropdown.contains(e.target) && e.target !== voiceMenuBtn) {
      voiceDropdown.classList.add("hidden");
    }
  });

  voiceSpeechToggle.checked = ttsEnabled;
  voiceSpeechToggle.addEventListener("change", (e) => {
    ttsEnabled = e.target.checked;
    localStorage.setItem("aura_tts", ttsEnabled ? "1" : "0");
    if (!ttsEnabled) {
      window.speechSynthesis.cancel();
      waveState = "ambient";
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  Task Activity Tracker ("jo task perform ho vo ana chaiye")
  // ═══════════════════════════════════════════════════════════════════════════
  function recordTaskExecution(name, args, result) {
    const timeStr = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const taskItem = { name, args, result, time: timeStr };
    performedTasks.unshift(taskItem);

    // Update top badge count
    if (taskBadge) taskBadge.textContent = performedTasks.length;

    // Render in drawer
    renderTaskTimeline();
  }

  function setLiveTaskStatus(name, isRunning) {
    if (!taskStatusPill) return;
    if (isRunning) {
      taskStatusPill.classList.remove("hidden");
      const iconMap = {
        system_diagnostics: "⚡ Running system diagnostics...",
        get_weather: "🌤️ Fetching weather data...",
        wikipedia_lookup: "📚 Searching Wikipedia knowledge...",
        calculate: "🧮 Calculating expression...",
        web_search: "🌐 Searching DuckDuckGo...",
        set_timer: "⏱️ Setting countdown timer...",
        unit_convert: "🔄 Converting units...",
        generate_code: "💻 Synthesizing code...",
        system_protocol: "🛡️ Executing system protocol...",
        tell_joke: "😄 Fetching humor subroutine...",
        get_current_datetime: "⏱️ Chrono-syncing time...",
        get_news_headlines: "📡 Retrieving intelligence...",
      };
      taskStatusText.textContent = iconMap[name] || `Executing ${name}...`;
    } else {
      taskStatusPill.classList.add("hidden");
    }
  }

  function renderTaskTimeline() {
    if (!taskTimeline) return;
    if (performedTasks.length === 0) {
      if (drawerEmpty) drawerEmpty.style.display = "flex";
      taskTimeline.innerHTML = "";
      return;
    }
    if (drawerEmpty) drawerEmpty.style.display = "none";

    taskTimeline.innerHTML = performedTasks.map(t => `
      <div class="timeline-item">
        <div class="timeline-header">
          <span class="timeline-name">⚡ ${escapeHtml(t.name)}</span>
          <span class="timeline-time">${t.time}</span>
        </div>
        <div class="timeline-result">${escapeHtml(t.result)}</div>
      </div>
    `).join("");
  }

  // Drawer Toggle Handlers
  tasksToggleBtn.addEventListener("click", () => {
    taskDrawer.classList.add("open");
    drawerBackdrop.classList.remove("hidden");
  });

  closeDrawerBtn.addEventListener("click", closeDrawer);
  drawerBackdrop.addEventListener("click", closeDrawer);

  function closeDrawer() {
    taskDrawer.classList.remove("open");
    drawerBackdrop.classList.add("hidden");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Send Directive / Message
  // ═══════════════════════════════════════════════════════════════════════════
  messageInput.addEventListener("input", () => {
    messageInput.style.height = "auto";
    messageInput.style.height = Math.min(messageInput.scrollHeight, 140) + "px";
    sendBtn.disabled = !messageInput.value.trim();
  });

  messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (messageInput.value.trim()) sendMessage();
    }
  });

  sendBtn.addEventListener("click", () => {
    if (messageInput.value.trim()) sendMessage();
  });

  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      initAudioContext();
      messageInput.value = chip.dataset.prompt;
      messageInput.dispatchEvent(new Event("input"));
      sendMessage();
    });
  });

  // Global Shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "m") {
      e.preventDefault();
      initAudioContext();
      if (isListening) stopListening();
      else startListening();
    }
    if (e.key === "Escape") {
      window.speechSynthesis.cancel();
      waveState = "ambient";
      if (isListening) stopListening();
      closeDrawer();
    }
  });

  resetBtn.addEventListener("click", async () => {
    initAudioContext();
    window.speechSynthesis.cancel();
    try { await fetch(`${API_BASE}/api/reset`, { method: "POST" }); } catch {}
    chatStream.innerHTML = "";
    chatStream.appendChild(heroScreen);
    heroScreen.classList.remove("hidden");
    waveState = "ambient";
    performedTasks = [];
    if (taskBadge) taskBadge.textContent = "0";
    renderTaskTimeline();
  });

  async function sendMessage() {
    if (sending) return;
    const text = messageInput.value.trim();
    if (!text) return;

    initAudioContext();
    sending = true;
    messageInput.value = "";
    messageInput.style.height = "auto";
    sendBtn.disabled = true;

    heroScreen.classList.add("hidden");

    appendUserMessage(text);

    waveState = "processing";
    const typingEl = showTyping();

    try {
      await handleStream(text, typingEl);
    } catch (err) {
      removeTyping(typingEl);
      waveState = "ambient";
      setLiveTaskStatus("", false);
      appendAIMessage(`**Notice:** ${err.message}`);
    }

    sending = false;
  }

  // ── Streaming (SSE) ───────────────────────────────────────────────────────
  async function handleStream(text, typingEl) {
    const res = await fetch(`${API_BASE}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, thinking: false }),
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
          case "tool_call":
            if (!removedTyping) { removeTyping(typingEl); removedTyping = true; }
            playSound("task");
            setLiveTaskStatus(event.name, true);
            appendTaskCard(event.name, event.args, null);
            break;

          case "tool_result": {
            setLiveTaskStatus(event.name, false);
            playSound("done");
            recordTaskExecution(event.name, {}, event.result);
            updateLastTaskCard(event.result);
            break;
          }

          case "text":
            if (!removedTyping) { removeTyping(typingEl); removedTyping = true; }
            if (!messageEl) {
              messageEl = appendAIMessage("");
            }
            fullText = event.content;
            const bubble = messageEl.querySelector(".msg-bubble");
            if (bubble) bubble.innerHTML = renderMarkdown(event.content);
            break;

          case "error":
            if (!removedTyping) { removeTyping(typingEl); removedTyping = true; }
            setLiveTaskStatus("", false);
            appendAIMessage(`**Notice:** ${event.content}`);
            break;

          case "done":
            setLiveTaskStatus("", false);
            break;
        }
      }
    }

    if (!removedTyping) removeTyping(typingEl);
    setLiveTaskStatus("", false);

    if (fullText) {
      speak(fullText);
    } else {
      waveState = "ambient";
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  UI Rendering Helpers
  // ═══════════════════════════════════════════════════════════════════════════
  function appendUserMessage(text) {
    const row = document.createElement("div");
    row.className = "msg-row user";
    const time = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

    row.innerHTML = `
      <div class="msg-avatar user-av">YOU</div>
      <div class="msg-bubble-wrap">
        <div class="msg-bubble">${escapeHtml(text)}</div>
        <div class="msg-time">${time}</div>
      </div>
    `;
    chatStream.appendChild(row);
    scrollToBottom();
    return row;
  }

  function appendAIMessage(text) {
    const row = document.createElement("div");
    row.className = "msg-row ai";
    const time = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

    row.innerHTML = `
      <div class="msg-avatar ai-av">AI</div>
      <div class="msg-bubble-wrap">
        <div class="msg-bubble">${renderMarkdown(text)}</div>
        <div class="msg-time">${time}</div>
      </div>
    `;
    chatStream.appendChild(row);
    scrollToBottom();
    return row;
  }

  function appendTaskCard(name, args, result) {
    const card = document.createElement("div");
    card.className = "live-task-card";

    const isDone = result !== null;
    const iconClass = isDone ? "done" : "running";
    const iconText = isDone ? "✓" : "⚡";

    card.innerHTML = `
      <div class="live-task-header">
        <div class="live-task-icon ${iconClass}">${iconText}</div>
        <div class="live-task-name">${escapeHtml(name)}</div>
        <span class="live-task-status-badge">${isDone ? "Completed" : "Running task"}</span>
        <span class="live-task-chevron">▼</span>
      </div>
      <div class="live-task-details">
        <div class="task-detail-section">
          <div class="task-detail-label">Arguments</div>
          <div class="task-detail-content">${escapeHtml(JSON.stringify(args, null, 2))}</div>
        </div>
        ${result ? `
          <div class="task-detail-section">
            <div class="task-detail-label">Result</div>
            <div class="task-detail-content">${escapeHtml(result)}</div>
          </div>
        ` : ""}
      </div>
    `;

    card.querySelector(".live-task-header").addEventListener("click", () => {
      card.classList.toggle("expanded");
    });

    chatStream.appendChild(card);
    scrollToBottom();
  }

  function updateLastTaskCard(result) {
    const cards = chatStream.querySelectorAll(".live-task-card");
    if (!cards.length) return;
    const last = cards[cards.length - 1];
    const icon = last.querySelector(".live-task-icon");
    if (icon) {
      icon.className = "live-task-icon done";
      icon.textContent = "✓";
    }
    const badge = last.querySelector(".live-task-status-badge");
    if (badge) badge.textContent = "Completed";

    const details = last.querySelector(".live-task-details");
    if (details && result) {
      const resSec = document.createElement("div");
      resSec.className = "task-detail-section";
      resSec.innerHTML = `
        <div class="task-detail-label">Result</div>
        <div class="task-detail-content">${escapeHtml(result)}</div>
      `;
      details.appendChild(resSec);
    }
  }

  function showTyping() {
    const el = document.createElement("div");
    el.className = "typing-wrap";
    el.innerHTML = `
      <div class="msg-avatar ai-av">AI</div>
      <div class="typing-pill">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `;
    chatStream.appendChild(el);
    scrollToBottom();
    return el;
  }

  function removeTyping(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      chatStream.scrollTop = chatStream.scrollHeight;
    });
  }

  // ── Markdown Parser ───────────────────────────────────────────────────────
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

})();
