const SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbxTiwK8b0bh08nvKCg7I0XipL4Z31ZYZnCmfzxQaTdm1ywY-TncHjVGjiPwBjWlVL5D/exec';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  try {
    let r = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
      redirect: 'manual',
    });

    if (r.status >= 300 && r.status < 400) {
      const location = r.headers.get('location');
      if (location) r = await fetch(location, { redirect: 'follow' });
    }

    const text = await r.text();

    // Strip HTML tags and return the plain error text so we can diagnose it
    if (text.trimStart().startsWith('<!DOCTYPE') || text.trimStart().startsWith('<html')) {
      const plain = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.status(200).send('DEBUG_ERROR: ' + plain.slice(0, 500));
      return;
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.status(200).send(text);
  } catch (err) {
    console.error('chat proxy error:', err);
    res.status(200).send('DEBUG_ERROR: ' + err.message);
  }
};
