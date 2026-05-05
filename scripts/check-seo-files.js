#!/usr/bin/env node
/**
 * check-seo-files.js
 * Verifies the presence and basic correctness of SEO-critical files:
 *  - robots.txt        (must exist, must contain Allow: /)
 *  - sitemap.xml       (must exist, must be valid XML with at least one <url>)
 *  - Every HTML file must have <meta name="description">, og:title, og:image,
 *    canonical link, and a JSON-LD <script> block.
 */

const fs   = require('fs');
const path = require('path');

const ROOT   = path.resolve(__dirname, '..');
const IGNORE = ['node_modules'];
// Widget/template HTML files that are not standalone pages
const SEO_EXCLUDE = ['KITChat.html'];

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

let errors = 0;

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  errors++;
}

function ok(msg) {
  console.log(`OK:   ${msg}`);
}

// 1. robots.txt
const robotsPath = path.join(ROOT, 'robots.txt');
if (!fs.existsSync(robotsPath)) {
  fail('robots.txt not found');
} else {
  const txt = fs.readFileSync(robotsPath, 'utf8');
  if (!txt.includes('Allow: /'))    fail('robots.txt missing "Allow: /"');
  else if (!txt.includes('Sitemap:')) fail('robots.txt missing Sitemap directive');
  else ok('robots.txt valid');
}

// 2. sitemap.xml
const sitemapPath = path.join(ROOT, 'sitemap.xml');
if (!fs.existsSync(sitemapPath)) {
  fail('sitemap.xml not found');
} else {
  const xml = fs.readFileSync(sitemapPath, 'utf8');
  if (!xml.includes('<urlset'))  fail('sitemap.xml missing <urlset>');
  else if (!xml.includes('<url>')) fail('sitemap.xml has no <url> entries');
  else ok(`sitemap.xml valid (${(xml.match(/<url>/g) || []).length} URLs)`);
}

// 3. Per-HTML SEO checks
const htmlFiles = walk(ROOT).filter(f => f.endsWith('.html') && !SEO_EXCLUDE.includes(path.basename(f)));

for (const file of htmlFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const rel     = path.relative(ROOT, file);

  const checks = [
    ['meta[name="description"]', /meta\s+name="description"/i],
    ['og:title',                 /property="og:title"/i],
    ['og:image',                 /property="og:image"/i],
    ['canonical',                /rel="canonical"/i],
    ['JSON-LD',                  /application\/ld\+json/i],
  ];

  for (const [label, re] of checks) {
    if (!re.test(content)) {
      fail(`${rel}: missing ${label}`);
    }
  }
}

const htmlCount = htmlFiles.length;
if (errors === 0) {
  console.log(`\ncheck-seo-files: OK — all ${htmlCount} HTML files pass SEO checks.`);
  process.exit(0);
} else {
  console.error(`\ncheck-seo-files: FAIL — ${errors} issue(s) found across ${htmlCount} HTML files.`);
  process.exit(1);
}
