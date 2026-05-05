#!/usr/bin/env node
/**
 * check-dead-links.js
 * Scans all HTML files for internal href/src references and verifies the
 * target files exist on disk. Reports any broken links.
 */

const fs   = require('fs');
const path = require('path');

const ROOT    = path.resolve(__dirname, '..');
const IGNORE  = ['node_modules'];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files   = [];
  for (const e of entries) {
    if (IGNORE.includes(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

const htmlFiles = walk(ROOT).filter(f => f.endsWith('.html'));

// Patterns to extract: href="..." and src="..." (non-external, non-anchor, non-mailto, non-tel)
const linkPattern = /(?:href|src)="([^"]+)"/g;

let errors = 0;

for (const file of htmlFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const dir     = path.dirname(file);
  let match;

  while ((match = linkPattern.exec(content)) !== null) {
    const raw = match[1];

    // Skip external, anchor-only, mailto, tel, data URIs, and runtime-injected paths
    if (/^(https?:|mailto:|tel:|data:|\/\/|#)/.test(raw)) continue;
    // Vercel analytics/edge and Cloudflare paths only exist in production
    if (raw.startsWith('/_vercel/') || raw.startsWith('/cdn-cgi/')) continue;
    // Skip JS template expressions embedded in HTML (e.g. widget script templates)
    if (raw.includes('${')) continue;

    // Resolve path relative to the HTML file
    const abs = raw.startsWith('/')
      ? path.join(ROOT, raw)
      : path.join(dir, raw);

    // Strip query string / hash
    const clean = abs.split('?')[0].split('#')[0];

    if (!fs.existsSync(clean)) {
      console.error(`BROKEN LINK in ${path.relative(ROOT, file)}: "${raw}"`);
      errors++;
    }
  }
}

if (errors === 0) {
  console.log('check-dead-links: OK — no broken internal links found.');
  process.exit(0);
} else {
  console.error(`check-dead-links: FAIL — ${errors} broken link(s) found.`);
  process.exit(1);
}
