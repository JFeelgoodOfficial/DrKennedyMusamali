# drkennedymusamali

Static site for Dr. Kennedy Musamali's transition consulting practice,
deployed on Vercel. Blog content is managed in [Sanity.io](https://www.sanity.io)
(see [SANITY_SETUP.md](SANITY_SETUP.md)) and rendered to static HTML at
build time.

## Layout

- `index.html`, `courses.html`, `media.html`, `blog.html`, `KITChat.html` — pages
- `templates/` — blog post + index-card templates used by the build
- `tools/build.js` — build script: renders blog posts (from Sanity, or from
  the legacy files in `blog/` when Sanity isn't configured), generates
  `sitemap.xml` and `llms.txt`, and assembles the deployable site in `dist/`
- `studio/` — embedded Sanity Studio (schema + config)
- `api/chat.js` — serverless KIT chat endpoint (Groq; needs `GROQ_API_KEY`)
- `scripts/` — browser JavaScript; `styles/` — CSS
- `tools/` — Node tooling (build, checks, one-off migrations)

## Commands

```bash
npm install
npm run build     # build the site into dist/
npx serve dist    # preview locally
npm test          # build + link/image/SEO checks + html-validate + stylelint
```

Deploys run `node tools/build.js` on Vercel (see `vercel.json`) with
`SANITY_PROJECT_ID` and `SANITY_DATASET` set in the project's
environment variables.
