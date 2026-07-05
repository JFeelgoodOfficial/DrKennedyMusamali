#!/usr/bin/env node
/**
 * migrate-posts-to-ndjson.js
 * One-time migration: converts the committed legacy posts in blog/*.html
 * into Sanity documents (portable text bodies) and writes
 * sanity-import.ndjson at the repo root.
 *
 * Import with:
 *   cd studio && npx sanity dataset import ../sanity-import.ndjson production
 *
 * Document _ids are deterministic (post-<slug>), so re-running the export
 * and re-importing overwrites rather than duplicates.
 *
 * Slugs keep the legacy filenames verbatim (including their misleading
 * 2026-05-06 date prefix) so live, indexed URLs do not change. Posts
 * authored in the Studio after migration get clean title-derived slugs.
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { htmlToBlocks } = require('@portabletext/block-tools');
const { Schema } = require('@sanity/schema');
const { extractPosts } = require('./extract-posts');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'sanity-import.ndjson');

// Minimal schema mirroring studio/schemaTypes/post.js — htmlToBlocks needs
// the compiled block type to know which marks/styles/lists are allowed.
const schema = Schema.compile({
  name: 'blog',
  types: [
    {
      name: 'post',
      type: 'document',
      fields: [
        { name: 'title', type: 'string' },
        {
          name: 'body',
          type: 'array',
          // The studio schema also allows image blocks, but the legacy
          // posts contain none and the standalone Schema.compile lacks
          // sanity's built-in image subtypes, so blocks-only is enough here.
          of: [{ type: 'block' }],
        },
      ],
    },
  ],
});

const blockContentType = schema
  .get('post')
  .fields.find(f => f.name === 'body').type;

let keyCounter = 0;
function nextKey() {
  keyCounter += 1;
  return `k${String(keyCounter).padStart(6, '0')}`;
}

// The NDJSON format requires stable _key values on array items; without
// them `sanity dataset import` generates random ones, which would make
// re-imports non-idempotent diffs. Deterministic keys keep the output
// reproducible run to run.
function addKeys(node) {
  if (Array.isArray(node)) {
    node.forEach(addKeys);
  } else if (node && typeof node === 'object') {
    if (node._type && !node._key) node._key = nextKey();
    Object.values(node).forEach(addKeys);
  }
}

function main() {
  const posts = extractPosts(path.join(ROOT, 'blog'));

  const lines = posts.map(post => {
    const blocks = htmlToBlocks(post.bodyHtml, blockContentType, {
      parseHtml: html => new JSDOM(html).window.document,
    });
    addKeys(blocks);

    return JSON.stringify({
      _id: `post-${post.slug}`,
      _type: 'post',
      title: post.title,
      slug: { _type: 'slug', current: post.slug },
      publishedAt: post.publishedAt,
      description: post.description,
      body: blocks,
    });
  });

  fs.writeFileSync(OUT, lines.join('\n') + '\n');
  console.log(`migrate: wrote ${lines.length} documents to ${path.relative(ROOT, OUT)}`);
  console.log('migrate: import with: cd studio && npx sanity dataset import ../sanity-import.ndjson production');
}

main();
