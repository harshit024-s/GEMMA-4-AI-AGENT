/* ═══════════════════════════════════════════════════════════════════════════
   Gemma 4 Agent – Frontend Logic
   ═══════════════════════════════════════════════════════════════════════════ */

(() => {
  "use strict";

  // ── DOM refs ───────────────────────────────────────────────────────────────
  const chatMessages   = document.getElementById("chat-messages");
  const messageInput   = document.getElementById("message-input");
  const sendBtn        = document.getElementById("send-btn");
  const toolsList      = document.getElementById("tools-list");
  const newChatBtn     = document.getElementById("new-chat-btn");
  const welcomeScreen  = document.getElementById("welcome-screen");
  const sidebarToggle  = document.getElementById("sidebar-toggle");
  const sidebar        = document.getElementById("sidebar");
  const thinkingToggle = document.getElementById("thinking-toggle");
  const streamToggle   = document.getElementById("stream-toggle");

  const API_BASE = "";  // same origin

  // ── Load tools list ────────────────────────────────────────────────────────
  async function loadTools() {
    try {
      const res  = await fetch(`${API_BASE}/api/tools`);
      const data = await res.json();
      toolsList.innerHTML = "";
      const icons = {
        web_search:           "🔍",
        get_weather:          "🌤️",
        calculate:            "🧮",
        get_current_datetime: "🕐",
        get_news_headlines:   "📰",
        generate_code:        "💻",
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
      toolsList.innerHTML = '<li class="tool-item"><div class="tool-desc">Failed to load tools.</div></li>';
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
      messageInput.value = chip.dataset.prompt;
      messageInput.dispatchEvent(new Event("input"));
      sendMessage();
    });
  });

  // ── New chat ───────────────────────────────────────────────────────────────
  newChatBtn.addEventListener("click", async () => {
    try { await fetch(`${API_BASE}/api/reset`, { method: "POST" }); } catch { /* ignore */ }
    chatMessages.innerHTML = "";
    chatMessages.appendChild(welcomeScreen);
    welcomeScreen.classList.remove("hidden");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  Send message
  // ═══════════════════════════════════════════════════════════════════════════
  let sending = false;

  async function sendMessage() {
    if (sending) return;
    const text = messageInput.value.trim();
    if (!text) return;

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

    // Show typing indicator
    const typingEl = showTyping();

    try {
      if (useStreaming) {
        await handleStream(text, useThinking, typingEl);
      } else {
        await handleNonStream(text, useThinking, typingEl);
      }
    } catch (err) {
      removeTyping(typingEl);
      appendMessage("agent", `**Error:** ${err.message}`);
    }

    sending = false;
  }

  // ── Non-streaming ─────────────────────────────────────────────────────────
  async function handleNonStream(text, thinking, typingEl) {
    const res  = await fetch(`${API_BASE}/api/chat`, {
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
      data.tool_calls.forEach((tc) => appendToolCall(tc.name, tc.args, tc.result));
    }

    // Render thinking
    if (data.thinking) {
      appendThinking(data.thinking);
    }

    // Render response
    appendMessage("agent", data.response);
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
            appendToolCall(event.name, event.args, null);
            break;

          case "tool_result": {
            // Update the last tool card with the result
            const cards = chatMessages.querySelectorAll(".tool-call-card");
            if (cards.length) {
              const last = cards[cards.length - 1];
              const icon = last.querySelector(".tool-call-icon");
              if (icon) { icon.classList.remove("calling"); icon.classList.add("done"); icon.textContent = "✓"; }
              const body = last.querySelector(".tool-call-body");
              if (body && event.result) {
                const sec = document.createElement("div");
                sec.className = "tool-call-section";
                sec.innerHTML = `<div class="tool-call-section-label">Result</div><div class="tool-call-json">${escapeHtml(event.result)}</div>`;
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
            const bubble = messageEl.querySelector(".message-bubble");
            if (bubble) {
              bubble.innerHTML = renderMarkdown(event.content);
            }
            break;

          case "error":
            if (!removedTyping) { removeTyping(typingEl); removedTyping = true; }
            appendMessage("agent", `**Error:** ${event.content}`);
            break;

          case "done":
            break;
        }
      }
    }

    if (!removedTyping) removeTyping(typingEl);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  UI helpers
  // ═══════════════════════════════════════════════════════════════════════════

  function appendMessage(role, text) {
    const row = document.createElement("div");
    row.className = `message-row ${role}`;

    const avatarChar = role === "user" ? "U" : "";
    const avatarSVG  = role === "agent"
      ? `<svg viewBox="0 0 32 32" width="20" height="20">
           <circle cx="16" cy="10" r="3" fill="#4285F4"/>
           <circle cx="10" cy="20" r="3" fill="#EA4335"/>
           <circle cx="22" cy="20" r="3" fill="#34A853"/>
           <line x1="16" y1="13" x2="10" y2="17" stroke="#FBBC05" stroke-width="1.5"/>
           <line x1="16" y1="13" x2="22" y2="17" stroke="#FBBC05" stroke-width="1.5"/>
           <line x1="10" y1="20" x2="22" y2="20" stroke="#FBBC05" stroke-width="1.5"/>
         </svg>` : avatarChar;

    row.innerHTML = `
      <div class="avatar ${role}-avatar">${avatarSVG}</div>
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
        <div class="tool-call-section-label">Arguments</div>
        <div class="tool-call-json">${escapeHtml(JSON.stringify(args, null, 2))}</div>
      </div>`;

    if (result !== null) {
      bodyHTML += `
        <div class="tool-call-section">
          <div class="tool-call-section-label">Result</div>
          <div class="tool-call-json">${escapeHtml(result)}</div>
        </div>`;
    }

    card.innerHTML = `
      <div class="tool-call-header">
        <div class="tool-call-icon ${statusIcon}">${statusChar}</div>
        <div class="tool-call-name">${escapeHtml(name)}</div>
        <div class="tool-call-chevron">▼</div>
      </div>
      <div class="tool-call-body">${bodyHTML}</div>`;

    card.querySelector(".tool-call-header").addEventListener("click", () => {
      card.classList.toggle("open");
    });

    // Insert before typing indicator or at end
    const wrapper = document.createElement("div");
    wrapper.className = "message-row agent";
    wrapper.style.paddingLeft = "44px";
    wrapper.appendChild(card);
    chatMessages.appendChild(wrapper);
    scrollToBottom();
  }

  function appendThinking(text) {
    const block = document.createElement("div");
    block.className = "message-row agent";
    block.style.paddingLeft = "44px";
    block.innerHTML = `
      <div class="thinking-block">
        <div class="thinking-label">💭 Thinking</div>
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
        <svg viewBox="0 0 32 32" width="20" height="20">
          <circle cx="16" cy="10" r="3" fill="#4285F4"/>
          <circle cx="10" cy="20" r="3" fill="#EA4335"/>
          <circle cx="22" cy="20" r="3" fill="#34A853"/>
          <line x1="16" y1="13" x2="10" y2="17" stroke="#FBBC05" stroke-width="1.5"/>
          <line x1="16" y1="13" x2="22" y2="17" stroke="#FBBC05" stroke-width="1.5"/>
          <line x1="10" y1="20" x2="22" y2="20" stroke="#FBBC05" stroke-width="1.5"/>
        </svg>
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
  //  Simple Markdown renderer (no external deps)
  // ═══════════════════════════════════════════════════════════════════════════
  function renderMarkdown(md) {
    if (!md) return "";
    let html = escapeHtml(md);

    // Extract fenced code blocks first so inner newlines/comments aren't mangled
    const codeBlocks = [];
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const idx = codeBlocks.length;
      codeBlocks.push(`<pre><code class="language-${lang}">${code.trim()}</code></pre>`);
      return `@@CODEBLOCK_${idx}@@`;
    });

    // Extract inline code
    const inlineCodes = [];
    html = html.replace(/`([^`]+)`/g, (_, code) => {
      const idx = inlineCodes.length;
      inlineCodes.push(`<code>${code}</code>`);
      return `@@INLINECODE_${idx}@@`;
    });

    // Headers
    html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
    html = html.replace(/^## (.+)$/gm,  "<h2>$1</h2>");
    html = html.replace(/^# (.+)$/gm,   "<h1>$1</h1>");

    // Bold and italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
    html = html.replace(/\*\*(.+?)\*\*/g,     "<strong>$1</strong>");
    html = html.replace(/\*(.+?)\*/g,         "<em>$1</em>");

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    // Unordered lists
    html = html.replace(/^- (.+)$/gm, "<li class=\"ul-item\">$1</li>");
    html = html.replace(/(<li class="ul-item">.*<\/li>\n?)+/g, (m) => `<ul>${m.replace(/ class="ul-item"/g, "")}</ul>`);

    // Ordered lists
    html = html.replace(/^\d+\. (.+)$/gm, "<li class=\"ol-item\">$1</li>");
    html = html.replace(/(<li class="ol-item">.*<\/li>\n?)+/g, (m) => `<ol>${m.replace(/ class="ol-item"/g, "")}</ol>`);

    // Blockquotes
    html = html.replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>");

    // Horizontal rules
    html = html.replace(/^---$/gm, "<hr>");

    // Paragraphs: wrap remaining lines separated by double newlines
    html = html.replace(/\n\n/g, "</p><p>");
    html = `<p>${html}</p>`;

    // Clean up empty paragraphs and those wrapping block elements
    html = html.replace(/<p>\s*<\/p>/g, "");
    html = html.replace(/<p>(<(?:h[1-6]|pre|ul|ol|blockquote|hr|li)[^>]*>)/g, "$1");
    html = html.replace(/(<\/(?:h[1-6]|pre|ul|ol|blockquote|hr|li)>)<\/p>/g, "$1");

    // Convert single newlines to <br> inside paragraphs
    html = html.replace(/\n/g, "<br>");

    // Restore inline code and fenced code blocks
    html = html.replace(/@@INLINECODE_(\d+)@@/g, (_, idx) => inlineCodes[Number(idx)]);
    html = html.replace(/@@CODEBLOCK_(\d+)@@/g, (_, idx) => {
      return `</p>${codeBlocks[Number(idx)]}<p>`;
    });
    html = html.replace(/<p>\s*<\/p>/g, "");

    return html;
  }

  function escapeHtml(s) {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return String(s).replace(/[&<>"']/g, (c) => map[c]);
  }
})();
