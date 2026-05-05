#!/usr/bin/env node
/**
 * check-images.js
 * Scans all HTML files for <img> tags and verifies:
 *  1. The src file exists (for local images)
 *  2. The alt attribute is present and non-empty
 */

const fs   = require('fs');
const path = require('path');

const ROOT   = path.resolve(__dirname, '..');
const IGNORE = ['node_modules'];

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

// Match <img ...> tags (may span a line)
const imgTagPattern  = /<img\s([^>]+)>/gi;
const attrPattern    = /(\w[\w-]*)="([^"]*)"/g;

let errors = 0;

for (const file of htmlFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const dir     = path.dirname(file);
  let imgMatch;

  while ((imgMatch = imgTagPattern.exec(content)) !== null) {
    const attrs   = {};
    const raw     = imgMatch[1];
    let attrMatch;

    while ((attrMatch = attrPattern.exec(raw)) !== null) {
      attrs[attrMatch[1].toLowerCase()] = attrMatch[2];
    }

    const src = attrs['src'] || '';
    const alt = attrs['alt'];
    const rel = path.relative(ROOT, file);

    // Check alt attribute
    if (alt === undefined) {
      console.error(`MISSING ALT in ${rel}: <img src="${src}">`);
      errors++;
    }

    // Check local src exists
    if (src && !src.startsWith('http') && !src.startsWith('data:') && !src.startsWith('//')) {
      const abs   = src.startsWith('/') ? path.join(ROOT, src) : path.join(dir, src);
      const clean = abs.split('?')[0];
      if (!fs.existsSync(clean)) {
        console.error(`MISSING IMAGE FILE in ${rel}: src="${src}" → ${clean}`);
        errors++;
      }
    }
  }
}

if (errors === 0) {
  console.log('check-images: OK — all images have alt text and local files exist.');
  process.exit(0);
} else {
  console.error(`check-images: FAIL — ${errors} issue(s) found.`);
  process.exit(1);
}
