// KIT Transition Coach chat widget
(function () {
  'use strict';

  let messageCount  = 0;
  let conversationHistory = [];
  let awaitingReply = false;
  let startersRemoved = false;
  let chatOpened = false;

  const panel       = document.getElementById('chat-panel');
  const launcherBtn = document.getElementById('launcher-btn');
  const launcherLbl = document.getElementById('launcher-label');
  const unreadDot   = document.getElementById('unread-dot');
  const messagesArea= document.getElementById('messages-area');
  const inputField  = document.getElementById('input-field');
  const sendBtn     = document.getElementById('send-btn');
  const progressFill= document.getElementById('progress-fill');
  const stepLabel   = document.getElementById('step-label');

  function toggleChat() {
    const isOpen = panel.classList.contains('open');
    if (isOpen) {
      panel.classList.remove('open');
      launcherBtn.classList.remove('open');
      launcherLbl.style.display = 'flex';
    } else {
      panel.classList.add('open');
      launcherBtn.classList.add('open');
      launcherLbl.style.display = 'none';
      unreadDot.classList.add('hidden');
      if (!chatOpened) {
        chatOpened = true;
        boot();
      } else {
        setTimeout(() => inputField.focus(), 200);
      }
    }
  }

  function boot() {
    const greeting = "Hello, and welcome. I'm your KIT Transition Coach, grounded in the Kennedy Integrated Transition Model developed by Dr. Kennedy Musamali.\n\nThis is a safe, reflective space. We'll move through ten thoughtful questions together — at whatever pace feels right for you. Where would you like to begin?";
    appendAiBubble(greeting);

    const starters = [
      "I'm going through a major life change and don't know where to start.",
      "I want help navigating a big shift using the KIT Model.",
      "I'm feeling overwhelmed and need help making sense of what I'm experiencing."
    ];

    const wrap = document.createElement('div');
    wrap.id = 'starters-row';
    const list = document.createElement('div');
    list.className = 'starters';
    starters.forEach(text => {
      const chip = document.createElement('button');
      chip.className = 'starter-chip';
      chip.textContent = text;
      chip.addEventListener('click', () => handleStarterClick(text));
      list.appendChild(chip);
    });
    wrap.appendChild(list);
    messagesArea.appendChild(wrap);
    scrollBottom();
    setTimeout(() => inputField.focus(), 300);
  }

  function removeStarters() {
    if (startersRemoved) return;
    const row = document.getElementById('starters-row');
    if (row) row.remove();
    startersRemoved = true;
  }

  function handleStarterClick(text) {
    inputField.value = text;
    sendMessage();
  }

  function sendMessage() {
    const text = inputField.value.trim();
    if (!text || awaitingReply) return;

    removeStarters();
    appendUserBubble(text);
    inputField.value = '';
    autoResize();

    messageCount++;
    conversationHistory.push({ role: 'user', content: text });
    updateProgress(messageCount);
    setLoading(true);

    const snap     = [...conversationHistory];
    const stepSnap = messageCount;

    fetch('https://script.google.com/macros/s/AKfycbxZhDoMCg8KXPsEkBeWwLd3qiyuots_nkxVJ1J5Kn1cg2aYvIJWjuyG6ndG4agIE3uE/exec', {
      method: 'POST',
      body: JSON.stringify({ history: snap, step: stepSnap })
    })
      .then(r => r.text())
      .then(reply => onReply(reply))
      .catch(err  => onError(err));
  }

  function onReply(raw) {
    setLoading(false);

    const ctaMatch = raw.match(/<!--KITCTA:([\s\S]*?)-->/);
    let displayText = raw;
    let ctaData = null;

    if (ctaMatch) {
      displayText = raw.replace(/<!--KITCTA:[\s\S]*?-->/, '').trim();
      try { ctaData = JSON.parse(ctaMatch[1]); } catch(e) {}
    }

    conversationHistory.push({ role: 'assistant', content: raw });
    appendAiBubble(displayText);
    if (ctaData) appendCtaCard(ctaData);

    if (messageCount >= 10) {
      inputField.disabled = true;
      sendBtn.disabled    = true;
      inputField.placeholder = 'Your journey is complete. See the next step above.';
    }

    scrollBottom();
  }

  function onError(err) {
    setLoading(false);
    appendAiBubble("Something went wrong on my end. Please try again, or reach Dr. Musamali directly at services@kennedymusamali.com.");
    console.error(err);
  }

  function appendAiBubble(text) {
    const row = document.createElement('div');
    row.className = 'msg-row';
    const av = document.createElement('div');
    av.className = 'msg-avatar ai-av';
    av.textContent = 'K';
    const bubble = document.createElement('div');
    bubble.className = 'bubble ai';
    bubble.innerHTML = '<p>' + escapeHtml(text).replace(/\n\n/g,'</p><p>').replace(/\n/g,'<br>') + '</p>';
    row.appendChild(av);
    row.appendChild(bubble);
    messagesArea.appendChild(row);
    scrollBottom();
  }

  function appendUserBubble(text) {
    const row = document.createElement('div');
    row.className = 'msg-row user';
    const av = document.createElement('div');
    av.className = 'msg-avatar user-av';
    av.textContent = '✦';
    const bubble = document.createElement('div');
    bubble.className = 'bubble user';
    bubble.textContent = text;
    row.appendChild(av);
    row.appendChild(bubble);
    messagesArea.appendChild(row);
    scrollBottom();
  }

  function appendCtaCard(cta) {
    const badgeMap = {
      counseling:            'Recommended: Counseling',
      consulting:            'Recommended: Consulting',
      coaching:              'Recommended: Coaching',
      workshop:              'Recommended: Workshop &amp; Training',
      course_college:        'College Transitions Course',
      course_career:         'Career Transitions Course',
      course_crosscultural:  'Cross-Cultural Transitions Course',
      course_organizational: 'Organizational Transitions Course',
      course_life:           'Life Transitions Course',
      course:                'Recommended Course'
    };
    const card = document.createElement('div');
    card.className = 'cta-card';
    card.innerHTML =
      '<div class="cta-badge">' + (badgeMap[cta.type] || 'Your Next Step') + '</div>' +
      '<div class="cta-title">' + escapeHtml(cta.title || '') + '</div>' +
      '<div class="cta-desc">'  + escapeHtml(cta.description || '') + '</div>' +
      '<a class="cta-btn" href="' + escapeHtml(cta.url || 'https://www.kennedymusamali.com') + '" target="_blank" rel="noopener">' +
        escapeHtml(cta.label || 'Learn More') +
      '</a>';
    messagesArea.appendChild(card);
    scrollBottom();
  }

  function setLoading(on) {
    awaitingReply = on;
    sendBtn.disabled = on;
    if (on) {
      const row = document.createElement('div');
      row.className = 'msg-row';
      row.id = 'typing-row';
      const av = document.createElement('div');
      av.className = 'msg-avatar ai-av';
      av.textContent = 'K';
      const dots = document.createElement('div');
      dots.className = 'typing-bubble';
      dots.innerHTML = '<span></span><span></span><span></span>';
      row.appendChild(av);
      row.appendChild(dots);
      messagesArea.appendChild(row);
      scrollBottom();
    } else {
      const t = document.getElementById('typing-row');
      if (t) t.remove();
    }
  }

  function updateProgress(step) {
    progressFill.style.width = Math.min((step / 10) * 100, 100) + '%';
    stepLabel.textContent = step < 10 ? 'Step ' + step + ' of 10' : 'Journey complete ✦';
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function scrollBottom() {
    requestAnimationFrame(() => { messagesArea.scrollTop = messagesArea.scrollHeight; });
  }

  function autoResize() {
    inputField.style.height = 'auto';
    inputField.style.height = Math.min(inputField.scrollHeight, 100) + 'px';
  }

  sendBtn.addEventListener('click', sendMessage);
  inputField.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  inputField.addEventListener('input', autoResize);

  window.toggleChat = toggleChat;
}());
