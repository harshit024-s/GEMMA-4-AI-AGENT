/* ═══════════════════════════════════════════════════════════════════════════
   J.A.R.V.I.S. Tactical Core – Frontend Logic & Audio Synthesizer
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
  const sidebarToggle    = document.getElementById("sidebar-toggle");
  const sidebar          = document.getElementById("sidebar");

  const API_BASE = "";

  // ── Audio / Voice State ───────────────────────────────────────────────────
  let voiceEnabled = true;
  let isListening = false;
  let recognition = null;
  let audioCtx = null;

  // ── Web Audio Synthesizer (Sci-Fi Sound FX) ───────────────────────────────
  function initAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
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
        // High-tech rising double-ping
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === "tool") {
        // Digital data blip
        osc.type = "triangle";
        osc.frequency.setValueAtTime(1046.5, now); // C6
        osc.frequency.exponentialRampToValueAtTime(1318.5, now + 0.08); // E6
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === "complete") {
        // Low warm confirmation chime
        osc.type = "sine";
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch {
      // Audio autoplay policy fallback
    }
  }

  // ── Text-to-Speech (JARVIS Voice Synthesis) ───────────────────────────────
  function speak(text) {
    if (!voiceEnabled || !("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel(); // Stop any active speech

    // Strip code blocks and Markdown syntax for natural vocalization
    let cleanText = text
      .replace(/```[\s\S]*?```/g, "Code block generated on terminal, sir.")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/[#*_~>]/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\n+/g, " ")
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.02;  // Crisp British cadence
    utterance.pitch = 0.94; // Calm, deep, authoritative

    // Find best British or English male voice
    const voices = window.speechSynthesis.getVoices();
    const jarvisVoice = voices.find(v => 
      v.lang.startsWith("en-GB") && (v.name.includes("Male") || v.name.includes("George") || v.name.includes("Oliver"))
    ) || voices.find(v => v.lang.startsWith("en-GB"))
      || voices.find(v => v.name.includes("Google UK English Male"))
      || voices.find(v => v.lang.startsWith("en"));

    if (jarvisVoice) {
      utterance.voice = jarvisVoice;
    }

    utterance.onstart = () => {
      setReactorState("speaking");
      audioVisualizer.classList.add("active");
      hudStatusText.textContent = "VOCALIZING RESPONSE, SIR...";
    };

    utterance.onend = () => {
      setReactorState("idle");
      audioVisualizer.classList.remove("active");
      hudStatusText.textContent = "SYSTEMS NOMINAL • ONLINE";
    };

    utterance.onerror = () => {
      setReactorState("idle");
      audioVisualizer.classList.remove("active");
      hudStatusText.textContent = "SYSTEMS NOMINAL • ONLINE";
    };

    window.speechSynthesis.speak(utterance);
  }

  // Ensure voices are loaded
  if ("speechSynthesis" in window) {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  }

  // ── Speech-to-Text (Voice Recognition) ────────────────────────────────────
  function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      micBtn.style.display = "none";
      console.warn("Speech recognition not supported in this browser environment.");
      return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      isListening = true;
      micBtn.classList.add("listening");
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
    if (state !== "idle") {
      arcReactor.classList.add(state);
    }
  }

  // ── Audio Mute Controls ───────────────────────────────────────────────────
  function updateAudioControls(enabled) {
    voiceEnabled = enabled;
    voiceToggle.checked = enabled;
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
  }

  voiceMuteBtn.addEventListener("click", () => {
    updateAudioControls(!voiceEnabled);
  });

  voiceToggle.addEventListener("change", (e) => {
    updateAudioControls(e.target.checked);
  });

  // ── Load Tools Registry ───────────────────────────────────────────────────
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
      toolsList.innerHTML = '<li class="tool-item"><div class="tool-desc">Tactical protocols standby.</div></li>';
    }
  }
  loadTools();

  // ── Auto-resize textarea ──────────────────────────────────────────────────
  messageInput.addEventListener("input", () => {
    messageInput.style.height = "auto";
    messageInput.style.height = Math.min(messageInput.scrollHeight, 160) + "px";
    sendBtn.disabled = !messageInput.value.trim();
  });

  // ── Keyboard shortcut ─────────────────────────────────────────────────────
  messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (messageInput.value.trim()) sendMessage();
    }
  });

  sendBtn.addEventListener("click", () => {
    if (messageInput.value.trim()) sendMessage();
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
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  Send Directive / Message
  // ═══════════════════════════════════════════════════════════════════════════
  let sending = false;

  async function sendMessage() {
    if (sending) return;
    const text = messageInput.value.trim();
    if (!text) return;

    initAudioContext();
    sending = true;
    messageInput.value = "";
    messageInput.style.height = "auto";
    sendBtn.disabled = true;

    // Hide welcome
    welcomeScreen.classList.add("hidden");

    // Render user bubble
    appendMessage("user", text);

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
    }

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

    // Render tool calls
    if (data.tool_calls && data.tool_calls.length) {
      playChime("tool");
      data.tool_calls.forEach((tc) => appendToolCall(tc.name, tc.args, tc.result));
    }

    // Render thinking
    if (data.thinking) {
      appendThinking(data.thinking);
    }

    // Render response
    appendMessage("agent", data.response);
    playChime("complete");

    // Speak response
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

    const avatarHTML = role === "user"
      ? "SIR"
      : `<div class="mini-arc-reactor" style="width:24px;height:24px;">
           <div class="core-dot" style="width:6px;height:6px;"></div>
         </div>`;

    row.innerHTML = `
      <div class="avatar ${role}-avatar">${avatarHTML}</div>
      <div class="message-content">
        <div class="message-bubble">${role === "user" ? escapeHtml(text) : renderMarkdown(text)}</div>
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

    html = html.replace(/^- (.+)$/gm, "<li class=\"ul-item\">$1</li>");
    html = html.replace(/(<li class="ul-item">.*<\/li>\n?)+/g, (m) => `<ul>${m.replace(/ class="ul-item"/g, "")}</ul>`);

    html = html.replace(/^\d+\. (.+)$/gm, "<li class=\"ol-item\">$1</li>");
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
