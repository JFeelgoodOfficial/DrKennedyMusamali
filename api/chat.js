const SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbxZhDoMCg8KXPsEkBeWwLd3qiyuots_nkxVJ1J5Kn1cg2aYvIJWjuyG6ndG4agIE3uE/exec';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  try {
    // POST to Apps Script — Google always 302-redirects to script.googleusercontent.com
    let r = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
      redirect: 'manual',
    });

    // Follow the redirect (POST executes the script; redirect retrieves the output)
    if (r.status >= 300 && r.status < 400) {
      const location = r.headers.get('location');
      if (location) r = await fetch(location);
    }

    const text = await r.text();
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.status(200).send(text);
  } catch (err) {
    console.error('chat proxy error:', err);
    res.status(500).send('error');
  }
};
