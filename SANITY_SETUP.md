# Sanity Blog Setup Guide

The blog now runs on [Sanity.io](https://www.sanity.io) — a content
platform with a friendly editor (the "Studio") — instead of the old
Google Doc pipeline. This guide takes you from zero to "publish a post
and the site updates itself in about a minute."

Until you finish these steps, **nothing breaks**: the site keeps
deploying with the 17 existing posts baked into the repository.

## How it works

```
You write in Sanity Studio ──publish──▶ Sanity Content Lake
                                             │ webhook
                                             ▼
                                    Vercel rebuilds the site
                                    (tools/build.js fetches posts,
                                     renders static HTML pages)
```

The site itself stays 100% static — fast, secure, great for SEO. Sanity
is only consulted at build time.

## Step 1 — Create a free Sanity account and project

1. Go to https://www.sanity.io and sign up (Google login is fine).
2. At https://sanity.io/manage click **Create project**. Name it
   something like `drkennedymusamali-blog`. The free plan is plenty.
3. Note the **Project ID** (a short code like `ab12cd34`) — you'll use
   it several times below.
4. In the project, under **Datasets**, create a dataset named
   `production` with visibility **Public**. (Public is intentional:
   blog content is public anyway, and it lets the site build without
   juggling API tokens.)

## Step 2 — Deploy the Studio (your writing interface)

On a computer with Node.js 18+ and this repository cloned:

```bash
cd studio
cp .env.example .env        # then edit .env: put your Project ID in it
npm install
npx sanity deploy           # log in when prompted, pick a hostname
                            # e.g. drkennedymusamali → https://drkennedymusamali.sanity.studio
```

Bookmark the studio URL — it's where you'll write posts from now on.
(You can also run it locally with `npm run dev`.)

## Step 3 — Import the 17 existing posts

Still in the repository:

```bash
cd ..                                        # back to the repo root
npm install
node tools/migrate-posts-to-ndjson.js        # writes sanity-import.ndjson
cd studio
npx sanity dataset import ../sanity-import.ndjson production
```

Open your Studio and confirm all 17 posts are there with their original
titles, dates, and content. (Re-running the import is safe — it
overwrites rather than duplicates.)

## Step 4 — Tell Vercel about Sanity

In the [Vercel dashboard](https://vercel.com), open the site's project:

1. **Settings → Environment Variables**, add to **Production and
   Preview**:
   - `SANITY_PROJECT_ID` = your Project ID
   - `SANITY_DATASET` = `production`

   > Naming note: the existing `GROQ_API_KEY` variable belongs to the
   > KIT chat widget (Groq is an AI company). Sanity's query language is
   > *also* called GROQ — pure coincidence, the two are unrelated. Don't
   > delete `GROQ_API_KEY`.

2. **Settings → Git → Deploy Hooks**: create a hook named
   `sanity-publish` on the production branch. Copy the URL it gives you.

## Step 5 — Rebuild the site automatically on publish

In [sanity.io/manage](https://sanity.io/manage), open your project:

1. **API → Webhooks → Create webhook**
2. Name: `Rebuild site`; URL: paste the Vercel deploy hook URL
3. Dataset: `production`
4. Trigger on: **Create**, **Update**, **Delete**
5. Filter: `_type == "post"`
6. Save.

Now every publish/edit/unpublish of a post triggers a fresh deploy.
The next Vercel deploy after Step 4 will build from Sanity (the build
log says `build: Sanity mode`).

## Step 6 — Connect the domain (SEO)

All of the site's SEO tags (canonical URLs, sitemap, social previews)
point at **https://www.kennedymusamali.com**. In Vercel:
**Settings → Domains** → add `www.kennedymusamali.com` (and
`kennedymusamali.com`, redirecting to the `www` version), then follow
the DNS instructions shown. Until the domain is connected, search
engines are being told the site lives at a URL that doesn't serve it —
so this step matters.

Afterwards, submit `https://www.kennedymusamali.com/sitemap.xml` in
[Google Search Console](https://search.google.com/search-console).

## Day-to-day: writing a post

1. Open your Studio URL.
2. Click **Blog post → +** and fill in:
   - **Title**
   - **Slug** — click *Generate*
   - **Publish date**
   - **Description** — 1–2 sentences, under 160 characters; this is what
     shows in Google results and link previews
   - **Body** — write normally; headings, bold, links, lists, and images
     all work
3. Click **Publish**. The site rebuilds itself; your post is live at
   `/blog/<slug>.html` with full SEO tags and a sitemap entry in about a
   minute.

## Cleanup once Sanity is live (optional, recommended)

After you've confirmed a production deploy in Sanity mode, the legacy
files in `blog/` are dead weight (Sanity and git history are the
backups). Delete the `blog/` directory in a follow-up commit.

## Troubleshooting

- **Build log says "falling back to the committed legacy posts"** — the
  `SANITY_PROJECT_ID` / `SANITY_DATASET` env vars aren't visible to the
  build. Check Step 4 and redeploy.
- **Published a post but the site didn't update** — check the webhook
  (Step 5) delivery log in sanity.io/manage → API → Webhooks.
- **Post missing from the site but visible in Studio** — make sure it's
  *published* (not a draft) and has a publish date and slug; the build
  skips drafts and documents without those fields.
