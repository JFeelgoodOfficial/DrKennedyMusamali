// Reflection chatbot on the media page: scripted, in-memory only,
// disappears on reload/close. No network calls.
(function () {
  'use strict';

  const reflectionWindow = document.getElementById('reflection-window');
  const reflectionForm = document.getElementById('reflection-form');
  const reflectionInput = document.getElementById('reflection-input');

  const reflectionScript = [
    {
      id: 1,
      prompt: "Have you experienced a change in your life that did not come easily — something where the \"internal transition\" lagged behind the external change?",
      followupMeta: "You can share as much or as little detail as you’d like."
    },
    {
      id: 2,
      prompt: "Thank you for naming that. When you look back at that season, what do you remember feeling most strongly — loss, confusion, pressure to \"keep up,\" something else?",
      followupMeta: "There isn’t a right answer here; we’re just putting language to your experience."
    },
    {
      id: 3,
      prompt: "If you could go back to that version of yourself, what kind of support, time, or \"psychological scaffolding\" would have helped you move through that transition with a little more kindness and clarity?",
      followupMeta: "You might think about time to learn, permission to not know yet, or people who could have walked with you."
    }
  ];

  let reflectionStep = 0;
  let reflectionFinished = false;

  function appendMessage(text, from = 'bot', meta) {
    const row = document.createElement('div');
    row.className = `chat-row ${from}`;
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${from}`;
    bubble.textContent = text;
    row.appendChild(bubble);

    if (meta) {
      const metaEl = document.createElement('div');
      metaEl.className = 'chat-meta';
      metaEl.textContent = meta;
      row.appendChild(metaEl);
    }

    reflectionWindow.appendChild(row);
    reflectionWindow.scrollTop = reflectionWindow.scrollHeight;
  }

  function startReflection() {
    if (!reflectionWindow) return;
    appendMessage(
      "If you’d like, we can spend three short questions connecting this video to your own experience of change.",
      'bot'
    );
    setTimeout(() => {
      const step = reflectionScript[0];
      appendMessage(step.prompt, 'bot', step.followupMeta);
      reflectionStep = 1;
    }, 600);
  }

  function handleUserResponse(text) {
    if (!text.trim() || reflectionFinished) return;
    appendMessage(text.trim(), 'user');
    reflectionInput.value = '';

    if (reflectionStep < reflectionScript.length) {
      const next = reflectionScript[reflectionStep];
      setTimeout(() => {
        appendMessage(next.prompt, 'bot', next.followupMeta);
        reflectionStep += 1;
      }, 650);
    } else if (!reflectionFinished) {
      reflectionFinished = true;
      setTimeout(() => {
        appendMessage(
          "Thank you for reflecting with this. If you’d like to take a next step, you might:",
          'bot'
        );
      }, 650);
      setTimeout(() => {
        appendMessage(
          "• Re‑watch part of the video with your own story in mind.\n• Explore other resources on this site.\n• Or, if you’re navigating a significant transition and want more support, you can reach out to Dr. Musamali directly.",
          'bot'
        );
      }, 1300);
      setTimeout(() => {
        appendMessage(
          "You can visit the contact section on this site to begin that conversation.",
          'bot'
        );
      }, 2100);
    }
  }

  if (reflectionForm && reflectionInput && reflectionWindow) {
    reflectionForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleUserResponse(reflectionInput.value);
    });

    reflectionInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleUserResponse(reflectionInput.value);
      }
    });

    window.addEventListener('load', startReflection);
  }
}());
