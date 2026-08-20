#!/usr/bin/env node
/**
 * build.js — generates the deployable site into dist/.
 *
 * Two modes:
 *  - Sanity mode (SANITY_PROJECT_ID + SANITY_DATASET set): blog posts are
 *    fetched from the Sanity Content Lake and rendered to static HTML.
 *    This is how production builds run once Sanity is configured; a
 *    Sanity webhook pointed at a Vercel deploy hook rebuilds the site on
 *    every publish.
 *  - Fallback mode (env vars absent): posts are parsed out of the
 *    committed legacy files in blog/ and rendered through the same
 *    template, so local builds and pre-Sanity deploys still produce a
 *    complete site with full per-post SEO.
 *
 * Always generated: dist/blog/<slug>.html, dist/blog.html (cards spliced
 * between POSTS_START/POSTS_END), dist/sitemap.xml, dist/llms.txt.
 */

const fs = require('fs');
const path = require('path');
const { toHTML } = require('@portabletext/to-html');
const { extractPosts, formatHumanDate } = require('./extract-posts');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SITE_URL = 'https://www.kennedymusamali.com';

const SANITY_PROJECT_ID = process.env.SANITY_PROJECT_ID;
const SANITY_DATASET = process.env.SANITY_DATASET;
const SANITY_API_VERSION = 'v2024-01-01';

// Static files copied into dist verbatim. The legacy Power-of-transition.png
// (~1 MB) is deliberately absent — pages use the optimized webp/jpg pair.
const STATIC_FILES = [
  'index.html',
  'courses.html',
  'media.html',
  'free-consultation.html',
  'KITChat.html',
  'robots.txt',
  'kennedy-musamali-headshot.jpg',
  'transition-consulting-approach.jpg',
  'power-of-transition.webp',
  'power-of-transition.jpg',
];
const STATIC_DIRS = ['styles', 'scripts'];

const PAGES = [
  { loc: '/', file: 'index.html' },
  { loc: '/free-consultation.html', file: 'free-consultation.html' },
  { loc: '/blog.html', file: 'blog.html' },
  { loc: '/courses.html', file: 'courses.html' },
  { loc: '/media.html', file: 'media.html' },
];

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fill(template, tokens) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in tokens)) throw new Error(`build: template token {{${key}}} has no value`);
    return tokens[key];
  });
}

async function fetchSanityPosts() {
  const query = `*[_type=="post" && !(_id in path("drafts.**")) && defined(slug.current) && defined(publishedAt)]|order(publishedAt desc){title,"slug":slug.current,publishedAt,description,body}`;
  const url = `https://${SANITY_PROJECT_ID}.apicdn.sanity.io/${SANITY_API_VERSION}/data/query/${SANITY_DATASET}?query=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`build: Sanity query failed: ${res.status} ${await res.text()}`);
  }
  const { result } = await res.json();

  return result.map(doc => {
    const publishedAt = String(doc.publishedAt).slice(0, 10);
    return {
      slug: doc.slug,
      title: doc.title,
      publishedAt,
      dateHuman: formatHumanDate(publishedAt),
      description: doc.description || '',
      bodyHtml: toHTML(doc.body || [], {
        components: {
          // Sanity image blocks need the CDN URL assembled from the asset ref:
          // image-<id>-<dims>-<format> -> https://cdn.sanity.io/images/...
          types: {
            image: ({ value }) => {
              const ref = value?.asset?._ref || '';
              const m = /^image-([a-zA-Z0-9]+)-(\d+x\d+)-(\w+)$/.exec(ref);
              if (!m) return '';
              const src = `https://cdn.sanity.io/images/${SANITY_PROJECT_ID}/${SANITY_DATASET}/${m[1]}-${m[2]}.${m[3]}`;
              const [w, h] = m[2].split('x');
              return `<img src="${src}" alt="${escapeHtml(value.alt || '')}" width="${w}" height="${h}" loading="lazy">`;
            },
          },
        },
      }),
    };
  });
}

function renderPost(template, post) {
  return fill(template, {
    TITLE: escapeHtml(post.title),
    TITLE_JSON: JSON.stringify(post.title),
    DESC: escapeHtml(post.description),
    DESC_JSON: JSON.stringify(post.description),
    SLUG: post.slug,
    DATE_ISO: post.publishedAt,
    DATE_HUMAN: post.dateHuman,
    BODY: post.bodyHtml,
  });
}

function renderCard(template, post) {
  const excerpt = post.description.length > 180
    ? post.description.slice(0, 180) + '…'
    : post.description;
  return fill(template, {
    SLUG: post.slug,
    DATE_HUMAN: post.dateHuman,
    TITLE: escapeHtml(post.title),
    EXCERPT: escapeHtml(excerpt),
  });
}

function buildSitemap(posts) {
  const today = new Date().toISOString().slice(0, 10);
  const entries = [
    ...PAGES.map(p => ({ loc: `${SITE_URL}${p.loc}`, lastmod: today })),
    ...posts.map(p => ({ loc: `${SITE_URL}/blog/${p.slug}.html`, lastmod: p.publishedAt })),
  ];
  const body = entries.map(e =>
    `  <url>\n    <loc>${e.loc}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n  </url>`
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

// llms.txt: a plain-markdown site guide for AI answer engines (AEO).
function buildLlmsTxt(posts) {
  const postLines = posts.map(p =>
    `- [${p.title}](${SITE_URL}/blog/${p.slug}.html): ${p.description}`
  ).join('\n');
  return `# Dr. Kennedy Musamali, Transition Consulting Services

> Dr. Kennedy Musamali, Ed.D., LPC-S, is a licensed counselor and change
> specialist based in the Dallas-Fort Worth, TX area. He helps two kinds of
> clients navigate change using his step-by-step KIT Model (Kennedy
> Integrated Transition Model):
>   1. Individuals and families moving through hard personal transitions,
>      such as divorce, career change, relocation, grief, or college.
>   2. Leaders and organizations managing the human side of change, such as
>      reorgs, mergers, and new systems, so the change sticks instead of
>      stalling in quiet resistance.
> Every engagement starts with a free 20-minute consultation. Contact:
> services@kennedymusamali.com, +1 469-844-8251.

## Services

- [Home](${SITE_URL}/): Counseling, consulting, coaching, and training for people and organizations in transition.
- [Free consultation](${SITE_URL}/free-consultation.html): Book a free, no-commitment 20-minute consultation. The place to start for all three service lines: personal transition counseling and coaching; organizational change consulting; and training, workshops, and speaking.
- [Courses](${SITE_URL}/courses.html): Five transition course topics, covering College, Career, Cross-Cultural, Organizational, and Life Transitions.
- [Media](${SITE_URL}/media.html): Talks and video, including "The Real Reason Change Fails".

## Blog

- [Blog index](${SITE_URL}/blog.html): Notes on transition, the psychology of change, resilience, and transition management.
${postLines}
`;
}

async function main() {
  // --- collect posts -------------------------------------------------
  let posts;
  if (SANITY_PROJECT_ID && SANITY_DATASET) {
    console.log(`build: Sanity mode (project ${SANITY_PROJECT_ID}, dataset ${SANITY_DATASET})`);
    posts = await fetchSanityPosts();
  } else {
    console.warn('build: WARNING — SANITY_PROJECT_ID/SANITY_DATASET not set.');
    console.warn('build: falling back to the committed legacy posts in blog/.');
    posts = extractPosts(path.join(ROOT, 'blog'));
  }
  if (!posts.length) throw new Error('build: no posts found — refusing to build an empty blog');
  console.log(`build: ${posts.length} posts`);

  // --- reset dist and copy static files ------------------------------
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(path.join(DIST, 'blog'), { recursive: true });

  for (const file of STATIC_FILES) {
    fs.copyFileSync(path.join(ROOT, file), path.join(DIST, file));
  }
  for (const dir of STATIC_DIRS) {
    fs.cpSync(path.join(ROOT, dir), path.join(DIST, dir), { recursive: true });
  }

  // --- render posts ---------------------------------------------------
  const postTemplate = fs.readFileSync(path.join(ROOT, 'templates', 'post.html'), 'utf8');
  const cardTemplate = fs.readFileSync(path.join(ROOT, 'templates', 'post-card.html'), 'utf8');

  for (const post of posts) {
    fs.writeFileSync(path.join(DIST, 'blog', `${post.slug}.html`), renderPost(postTemplate, post));
  }

  // --- blog index -----------------------------------------------------
  const blogIndex = fs.readFileSync(path.join(ROOT, 'blog.html'), 'utf8');
  const cards = posts.map(p => renderCard(cardTemplate, p)).join('');
  const spliced = blogIndex.replace(
    /<!-- POSTS_START -->[\s\S]*<!-- POSTS_END -->/,
    `<!-- POSTS_START -->\n${cards}<!-- POSTS_END -->`
  );
  if (spliced === blogIndex) throw new Error('build: POSTS_START/POSTS_END markers not found in blog.html');
  fs.writeFileSync(path.join(DIST, 'blog.html'), spliced);

  // --- sitemap + llms.txt ----------------------------------------------
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), buildSitemap(posts));
  fs.writeFileSync(path.join(DIST, 'llms.txt'), buildLlmsTxt(posts));

  console.log(`build: done — dist/ contains ${fs.readdirSync(DIST).length} top-level entries`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
