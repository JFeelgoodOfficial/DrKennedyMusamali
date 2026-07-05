#!/usr/bin/env node
/**
 * optimize-images.js
 * One-off optimizer for the newsletter banner. The source PNG is ~1 MB;
 * this produces a WebP plus a resized PNG fallback (both committed) that
 * the <picture> element in blog.html / post pages references.
 *
 * Usage: node tools/optimize-images.js
 */

const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'Power-of-transition.png');
const MAX_WIDTH = 1600;

(async () => {
  const meta = await sharp(SRC).metadata();
  console.log(`source: ${meta.width}x${meta.height}`);

  const pipeline = sharp(SRC).resize({ width: MAX_WIDTH, withoutEnlargement: true });

  const webp = await pipeline
    .clone()
    .webp({ quality: 82 })
    .toFile(path.join(ROOT, 'power-of-transition.webp'));
  console.log(`power-of-transition.webp: ${webp.width}x${webp.height}, ${(webp.size / 1024).toFixed(0)} KB`);

  const jpg = await pipeline
    .clone()
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 85, mozjpeg: true })
    .toFile(path.join(ROOT, 'power-of-transition.jpg'));
  console.log(`power-of-transition.jpg: ${jpg.width}x${jpg.height}, ${(jpg.size / 1024).toFixed(0)} KB`);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
