// api/lead.js — consultation requests from free-consultation.html
//
// Accepts both shapes the landing page can send:
//   * application/json          — the fetch() path, answered with JSON
//   * form-urlencoded           — the plain <form> POST used when the page's
//                                 JavaScript never runs, answered with HTML
//
// DELIVERY REQUIRES CONFIGURATION. Set one of these in the Vercel project
// (Settings → Environment Variables), or submissions are refused with a 503
// and the page tells the visitor to email instead — a lead is never silently
// swallowed:
//
//   LEAD_WEBHOOK_URL   Any endpoint that accepts a JSON POST (Zapier, Make,
//                      a Slack Incoming Webhook, an inbox automation).
//                      Slack URLs are detected and sent Slack's {text:...}.
//
//   RESEND_API_KEY     A Resend API key. Also set LEAD_TO_EMAIL (defaults to
//   LEAD_TO_EMAIL      services@kennedymusamali.com) and, if the sending
//   LEAD_FROM_EMAIL    domain is verified, LEAD_FROM_EMAIL.
//
// If both are set the webhook runs first and email is the fallback.

const ALLOWED_ORIGINS = new Set([
  'https://www.kennedymusamali.com',
  'https://kennedymusamali.com',
  'https://dr-kennedy-musamali.vercel.app',
]);

const CONTACT_EMAIL = 'services@kennedymusamali.com';
const CONTACT_PHONE = '469-844-8251';

const MAX_BODY_BYTES = 16 * 1024;
const FIELD_LIMITS = { name: 120, email: 200, phone: 40, segment: 40, message: 1200 };

const SEGMENTS = {
  personal: 'Something in my own life',
  organization: 'Change inside my organization',
  training: 'Training or a speaker for my group',
  other: 'Something else',
};

// Best-effort per-IP limit. Serverless instances are stateless and scale
// horizontally, so this bounds abuse per warm instance rather than globally;
// the field caps above are the real cost bound.
const RATE_LIMIT = 6;
const RATE_WINDOW_MS = 10 * 60 * 1000;
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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Vercel parses JSON and form bodies for us, but a raw string can still
// arrive when the content type is unusual.
function readBody(req) {
  const body = req.body;
  if (!body) return null;
  if (typeof body === 'object') return body;
  if (typeof body !== 'string') return null;
  if (body.length > MAX_BODY_BYTES) return null;
  try {
    return JSON.parse(body);
  } catch (e) {
    return Object.fromEntries(new URLSearchParams(body));
  }
}

function field(body, key) {
  const value = body[key];
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, FIELD_LIMITS[key] || 200);
}

// Returns {lead} or {error} with a message written for the visitor.
function validate(body) {
  if (!body || typeof body !== 'object') return { error: 'That submission could not be read.' };

  // Honeypot. Real people never see this field; bots fill it in.
  if (field(body, 'company')) return { spam: true };

  const name = field(body, 'name');
  const email = field(body, 'email');
  const phone = field(body, 'phone');
  const segment = field(body, 'segment');
  const message = field(body, 'message');
  const consent = body.consent === 'yes' || body.consent === true || body.consent === 'on';

  if (!name) return { error: 'Please add your name so I know who I am replying to.' };
  // Deliberately permissive: the cost of rejecting a real address is far
  // higher than the cost of accepting one that bounces.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { error: 'That email address does not look right — please check it.' };
  }
  if (!SEGMENTS[segment]) return { error: 'Please choose which kind of change you are facing.' };
  if (!consent) return { error: 'Please tick the box so I know it is OK to contact you.' };

  return { lead: { name, email, phone, segment, message } };
}

function formatLead(lead, meta) {
  return [
    'New consultation request — kennedymusamali.com',
    '',
    `Name:     ${lead.name}`,
    `Email:    ${lead.email}`,
    `Phone:    ${lead.phone || '—'}`,
    `Segment:  ${SEGMENTS[lead.segment]}`,
    '',
    'Message:',
    lead.message || '(none)',
    '',
    `Received: ${meta.receivedAt}`,
    `Source:   ${meta.source}`,
  ].join('\n');
}

async function deliverWebhook(url, lead, meta, text) {
  const isSlack = /hooks\.slack\.com/.test(url);
  const payload = isSlack ? { text } : { ...lead, segmentLabel: SEGMENTS[lead.segment], ...meta, text };
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`webhook responded ${r.status}`);
}

async function deliverEmail(apiKey, lead, text) {
  const to = process.env.LEAD_TO_EMAIL || CONTACT_EMAIL;
  const from = process.env.LEAD_FROM_EMAIL || 'onboarding@resend.dev';
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: lead.email,
      subject: `Consultation request — ${lead.name} (${SEGMENTS[lead.segment]})`,
      text,
    }),
  });
  if (!r.ok) throw new Error(`resend responded ${r.status}`);
}

// The no-JS path posts a document request and must get a document back.
function htmlReply(res, status, heading, body) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(status).send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex">
<title>${escapeHtml(heading)} — Dr. Kennedy Musamali</title>
<link rel="stylesheet" href="/styles/landing.css">
</head>
<body class="page-lp">
<header class="lp-header">
  <a class="lp-logo" href="/">Dr. Kennedy <span>Musamali</span></a>
</header>
<main class="lp-section">
  <div class="lp-wrap">
    <p class="lp-label">Consultation request</p>
    <h1 class="lp-h2">${escapeHtml(heading)}</h1>
    <p class="lp-lede">${body}</p>
    <p class="lp-lede"><a href="/free-consultation.html">← Back to the consultation page</a></p>
  </div>
</main>
</body>
</html>`);
}

module.exports = async function handler(req, res) {
  const wantsJson = /application\/json/.test(String(req.headers['content-type'] || ''));

  const fail = (status, message, heading) => {
    if (wantsJson) {
      res.status(status).json({ ok: false, error: message });
    } else {
      htmlReply(res, status, heading || 'That did not send', message);
    }
  };

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
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
    fail(429, `Too many requests from this connection. Please email ${CONTACT_EMAIL} instead.`);
    return;
  }

  const result = validate(readBody(req));

  // Spam gets the success response a bot expects, and goes nowhere.
  if (result.spam) {
    if (wantsJson) res.status(200).json({ ok: true });
    else htmlReply(res, 200, 'Thank you', 'Your request has been received.');
    return;
  }

  if (result.error) {
    fail(400, escapeHtml(result.error), 'Check one thing');
    return;
  }

  const lead = result.lead;
  const meta = {
    receivedAt: new Date().toISOString(),
    source: wantsJson ? 'free-consultation.html (fetch)' : 'free-consultation.html (form post)',
  };
  const text = formatLead(lead, meta);

  const webhookUrl = process.env.LEAD_WEBHOOK_URL;
  const resendKey = process.env.RESEND_API_KEY;

  if (!webhookUrl && !resendKey) {
    // Refusing loudly is the only honest option: accepting the request and
    // dropping it would cost a real lead with no trace.
    console.error('lead: no LEAD_WEBHOOK_URL or RESEND_API_KEY configured — refusing to accept a lead it cannot deliver');
    fail(
      503,
      `Online booking is not connected yet. Please email <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> or call ${CONTACT_PHONE}.`,
      'Please email instead',
    );
    return;
  }

  const errors = [];

  if (webhookUrl) {
    try {
      await deliverWebhook(webhookUrl, lead, meta, text);
      if (wantsJson) res.status(200).json({ ok: true });
      else htmlReply(res, 200, 'Thank you — that came through',
        `Dr. Musamali will reply personally, usually within one business day. If it is urgent, call ${CONTACT_PHONE}.`);
      return;
    } catch (err) {
      errors.push(`webhook: ${err.message}`);
    }
  }

  if (resendKey) {
    try {
      await deliverEmail(resendKey, lead, text);
      if (wantsJson) res.status(200).json({ ok: true });
      else htmlReply(res, 200, 'Thank you — that came through',
        `Dr. Musamali will reply personally, usually within one business day. If it is urgent, call ${CONTACT_PHONE}.`);
      return;
    } catch (err) {
      errors.push(`resend: ${err.message}`);
    }
  }

  // Delivery failed. Log the whole lead so it is recoverable from the
  // function logs rather than lost.
  console.error('lead: delivery failed —', errors.join('; '));
  console.error('lead: unsent submission follows\n' + text);
  fail(
    502,
    `That did not send. Please email <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> or call ${CONTACT_PHONE}.`,
  );
};
