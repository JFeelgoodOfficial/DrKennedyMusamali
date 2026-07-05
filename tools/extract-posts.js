/**
 * extract-posts.js
 * Parses the committed legacy post files in blog/*.html into structured
 * objects. Used by build.js (fallback mode, when Sanity env vars are not
 * configured) and by migrate-posts-to-ndjson.js (one-time Sanity import).
 *
 * The legacy files are machine-generated and uniform: title in
 * h1.post-title, human-readable publish date in .post-meta, content in
 * .post-body. Filenames all carry the scrape date (2026-05-06), so the
 * real publish date comes from .post-meta, not the filename.
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

// "April 14, 2026" -> "2026-04-14"; returns null if unparseable.
function parseHumanDate(text) {
  const m = /([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/.exec(text || '');
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase()];
  if (!month) return null;
  const day = parseInt(m[2], 10);
  return `${m[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatHumanDate(iso) {
  const [y, mo, d] = iso.split('-').map(Number);
  const names = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  return `${names[mo - 1]} ${d}, ${y}`;
}

// First substantive paragraph, trimmed to ~155 chars at a word boundary.
// Skips short quote/attribution openers so the description reads like a
// summary rather than an epigraph.
function deriveDescription(paragraphs) {
  let pick = null;
  for (const text of paragraphs) {
    const t = text.replace(/\s+/g, ' ').trim();
    if (!t) continue;
    if (!pick) pick = t;
    const looksLikeQuote = /^["“”']/.test(t) || (/—/.test(t) && t.length < 220);
    if (t.length >= 80 && !looksLikeQuote) {
      pick = t;
      break;
    }
  }
  if (!pick) return '';
  if (pick.length <= 155) return pick;
  const cut = pick.slice(0, 155);
  return cut.slice(0, cut.lastIndexOf(' ')) + '…';
}

/**
 * Returns [{slug, title, publishedAt, dateHuman, description, bodyHtml}]
 * sorted by publishedAt descending.
 */
function extractPosts(blogDir) {
  const files = fs.readdirSync(blogDir)
    .filter(f => f.endsWith('.html') && !f.startsWith('_'));

  const posts = files.map(file => {
    const html = fs.readFileSync(path.join(blogDir, file), 'utf8');
    const doc = new JSDOM(html).window.document;

    const title = (doc.querySelector('h1.post-title')?.textContent || '').trim();
    const metaText = (doc.querySelector('.post-meta')?.textContent || '').trim();
    const body = doc.querySelector('.post-body');
    if (!title || !body) {
      throw new Error(`extract-posts: ${file} is missing .post-title or .post-body`);
    }

    const slug = file.replace(/\.html$/, '');
    // Real publish date lives in .post-meta; the filename date is the
    // scrape date and only serves as a last-resort fallback.
    const publishedAt = parseHumanDate(metaText)
      || (/^\d{4}-\d{2}-\d{2}/.exec(file) || [null])[0];
    if (!publishedAt) {
      throw new Error(`extract-posts: ${file} has no parseable publish date`);
    }

    const paragraphs = [...body.querySelectorAll('p')].map(p => p.textContent);

    return {
      slug,
      title,
      publishedAt,
      dateHuman: formatHumanDate(publishedAt),
      description: deriveDescription(paragraphs),
      bodyHtml: body.innerHTML.trim(),
    };
  });

  posts.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return posts;
}

module.exports = { extractPosts, parseHumanDate, formatHumanDate, deriveDescription };
