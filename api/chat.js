const SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbxTiwK8b0bh08nvKCg7I0XipL4Z31ZYZnCmfzxQaTdm1ywY-TncHjVGjiPwBjWlVL5D/exec';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  try {
    // Step 1: POST to Apps Script with manual redirect so we can inspect the chain
    let r = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
      redirect: 'manual',
    });

    console.log('GAS initial status:', r.status);
    console.log('GAS location:', r.headers.get('location'));

    // Step 2: follow redirect if present
    if (r.status >= 300 && r.status < 400) {
      const location = r.headers.get('location');
      if (location) {
        r = await fetch(location, { redirect: 'follow' });
        console.log('GAS redirect status:', r.status);
      }
    }

    const text = await r.text();
    console.log('GAS response preview:', text.slice(0, 300));

    // If Google returned an HTML error page, surface the actual error text
    if (text.trimStart().startsWith('<!DOCTYPE') || text.trimStart().startsWith('<html')) {
      const match = text.match(/<div[^>]*>(.*?)<\/div>/s);
      const detail = match ? match[1].replace(/<[^>]+>/g, '').trim() : 'unknown error';
      console.error('GAS HTML error:', detail);
      res.status(502).send('Apps Script error: ' + detail);
      return;
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.status(200).send(text);
  } catch (err) {
    console.error('chat proxy error:', err);
    res.status(500).send('error');
  }
};
