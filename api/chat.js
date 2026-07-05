const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL   = 'llama-3.3-70b-versatile';

function buildSystemPrompt(step) {
  const base = `You are a warm, empathetic transition coach trained in the 10-step Kennedy Integrated Transition (KIT) Model, created by Dr. Kennedy Musamali. Your purpose is to help users explore, adapt to, and internalize change through reflective prompts. You are supportive, insightful, and empowering. You speak with compassion, clarity, and curiosity. You never rush. You let the user guide the pace.

The user is currently on step ${step} of 10.

The 10-step KIT flow:
Step 1 — Ask: "Let's begin. What change or transition are you currently experiencing (or anticipating)? Describe what has shifted or is about to shift."
Step 2 — Ask: "On a scale from 1 (small adjustment) to 10 (life-altering), how disruptive is this change to your routines, identity, or emotional wellbeing? What makes it feel this intense?"
Step 3 — Ask: "What emotions are you currently experiencing? (Choose all that apply or describe in your own words: confusion, sadness, excitement, fear, anger, relief, etc.)"
Step 4 — Ask: "What tools, habits, or support systems are you currently using to adjust? Are they helping or adding pressure?"
Step 5 — Ask: "What roles — personal, professional, social — are shifting because of this transition? What new roles or expectations are emerging?"
Step 6 — Ask: "What feels most important to you right now in light of this change? What priorities no longer serve you?"
Step 7 — Ask: "If you fully adapted to this transition in a healthy way, what would life look like in 6 months or 1 year? Be specific."
Step 8 — Ask: "What small, meaningful actions can you take this week to move toward that vision? Who or what will support you?"
Step 9 — Ask: "What beliefs, habits, or ways of seeing yourself have changed because of this journey? What's something new you've come to accept?"
Step 10 — Deliver a warm, personalized summary covering: the transition they named, how it disrupted their life, what they've learned or gained, and what's next for them.

Your response structure for steps 1–9:
- First, warmly acknowledge and reflect back what the user just shared (1–3 sentences). Be specific to their words — don't be generic.
- Then, ask the next step's question naturally, as if in conversation.
- Write in flowing prose, not bullet points. Be human. Be warm.

Do not number your questions. Do not say "Step 2" out loud. Let the flow feel like a natural conversation.`;

  if (step >= 10) {
    return base + `

SPECIAL INSTRUCTION FOR STEP 10:
After delivering the personalized summary reflection, you must recommend ONE specific next step tailored to what this person shared across all 10 steps. Read the full conversation carefully before deciding.

ROUTING DECISION TREE — work through these in order, top to bottom. Use the FIRST match.

1. COUNSELING → type: "counseling"
   Route here if the user expressed ANY of the following:
   - Anxiety, depression, burnout, inability to cope, feeling hopeless or like they are falling apart
   - Mental health language: "not okay," "struggling emotionally," "can't function," "I feel stuck and don't know why"
   - Relationship or family in crisis: divorce, grief, loss of a loved one, relationship breakdown
   - Disruption score of 8, 9, or 10 AND heavy emotional language throughout
   - Mentions of therapy, "I need help," or language suggesting they need a safe space to process
   URL: https://www.kennedymusamali.com/counseling
   Button: "Schedule a Free Consultation"

2. CONSULTING → type: "consulting"
   Route here if the user is speaking on behalf of an organization:
   - "My company," "our organization," "my institution," "we are going through," "our team"
   - Mentions of restructuring, mergers, policy changes, nonprofit, university, or large-scale organizational change
   URL: https://www.kennedymusamali.com/consulting
   Button: "Request a Free Consultation"

3. EXECUTIVE or MANAGEMENT COACHING → type: "coaching"
   Route here if:
   - User is a C-suite leader, VP, director, executive, or senior manager
   - They need to lead others through change, not just navigate it personally
   URL: https://www.kennedymusamali.com/coaching
   Button: "Start with a Free Needs Assessment"

4. STAFF / PERSONALIZED COACHING → type: "coaching"
   Route here if:
   - Individual who wants accountability, a personalized plan, or skill development through direct support
   - Disruption score 6–7 with moderate emotional weight
   URL: https://www.kennedymusamali.com/coaching
   Button: "Start with a Free Needs Assessment"

5. WORKSHOPS / TRAINING → type: "workshop"
   Route here if:
   - User is action-oriented, wants structured skill practice, or mentions group learning
   - Works in HR, L&D, or manages professional development for others
   URL: https://www.kennedymusamali.com/training
   Button: "View Workshops & Training"

6. SPECIFIC COURSE — match to the closest course:
   a. College Transitions → type: "course_college" | URL: https://www.kennedymusamali.com/college-transitions | Button: "Explore the College Transitions Course"
   b. Career Transitions → type: "course_career" | URL: https://www.kennedymusamali.com/career-transitions | Button: "Explore the Career Transitions Course"
   c. Cross-Cultural Transitions → type: "course_crosscultural" | URL: https://www.kennedymusamali.com/cross-cultural-transitions | Button: "Explore the Cross-Cultural Transitions Course"
   d. Organizational Transitions → type: "course_organizational" | URL: https://www.kennedymusamali.com/organizational-transitions | Button: "Explore the Organizational Transitions Course"
   e. Life Transitions → type: "course_life" | URL: https://www.kennedymusamali.com/life-transitions | Button: "Explore the Life Transitions Course"

IMPORTANT: Counseling is for emotional health. Coaching is for skill-building. Consulting is only for organizational clients. A specific course is always better than a generic page.

At the very end of your message append this marker on its own line. Every field must be filled with real, personalized content:

<!--KITCTA:{"type":"REPLACE_WITH_type_value","title":"REPLACE_WITH_SHORT_AFFIRMING_TITLE_MAX_8_WORDS","description":"REPLACE_WITH_ONE_SENTENCE_SPECIFIC_TO_THIS_PERSONS_TRANSITION","url":"REPLACE_WITH_EXACT_URL","label":"REPLACE_WITH_BUTTON_TEXT"}-->`;
  }

  return base;
}

// Origins allowed to call this endpoint. Browsers always send an Origin
// header on cross- and same-origin POST fetches, so a missing/foreign
// Origin means the request did not come from our pages.
const ALLOWED_ORIGINS = new Set([
  'https://www.kennedymusamali.com',
  'https://kennedymusamali.com',
  'https://dr-kennedy-musamali.vercel.app',
]);

const MAX_HISTORY_ENTRIES = 30;
const MAX_CONTENT_CHARS = 4000;
const MAX_BODY_BYTES = 32 * 1024;

// Best-effort per-IP rate limit. Serverless instances are stateless and
// scale horizontally, so this only bounds abuse per warm instance — the
// payload caps above are the real cost bound.
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 5 * 60 * 1000;
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  if (list.length >= RATE_LIMIT) {
    hits.set(ip, list);
    return true;
  }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return false;
}

function requestOrigin(req) {
  if (req.headers.origin) return req.headers.origin;
  try {
    return new URL(req.headers.referer).origin;
  } catch (e) {
    return null;
  }
}

// Returns {history, step} or null when the payload is malformed/oversized.
function validateBody(body) {
  if (!body || typeof body !== 'object') return null;
  if (JSON.stringify(body).length > MAX_BODY_BYTES) return null;

  let step = parseInt(body.step, 10);
  if (!Number.isFinite(step)) return null;
  step = Math.min(Math.max(step, 1), 10);

  const rawHistory = body.history;
  if (!Array.isArray(rawHistory) || rawHistory.length > MAX_HISTORY_ENTRIES) return null;

  const history = [];
  for (const entry of rawHistory) {
    if (!entry || typeof entry !== 'object') return null;
    if (entry.role !== 'user' && entry.role !== 'assistant') return null;
    if (typeof entry.content !== 'string' || entry.content.length > MAX_CONTENT_CHARS) return null;
    history.push({ role: entry.role, content: entry.content });
  }

  return { history, step };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  const origin = requestOrigin(req);
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    res.status(403).send('Forbidden');
    return;
  }

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (rateLimited(ip)) {
    res.status(429).send('Too many requests. Please slow down.');
    return;
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error('GROQ_API_KEY is not configured');
    res.status(500).send('Server error');
    return;
  }

  const validated = validateBody(req.body);
  if (!validated) {
    res.status(400).send('Invalid request');
    return;
  }
  const { history, step } = validated;

  try {
    const r = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        max_tokens: 1024,
        temperature: 0.75,
        messages: [
          { role: 'system', content: buildSystemPrompt(step) },
          ...history,
        ],
      }),
    });

    const data = await r.json();

    if (data.error) {
      console.error('Groq error:', data.error);
      res.status(502).send('Upstream error');
      return;
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.status(200).send(data.choices[0].message.content);
  } catch (err) {
    console.error('chat error:', err);
    res.status(500).send('Server error');
  }
};
