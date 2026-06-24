# X Tweet Helper

A self-hosted growth workspace for **X (Twitter)** — draft tweets and threads with AI, write long-form blogs, track consistency, and post without burning API credits when you don't need to.

Built for a single creator account: sign in with X, compose in the browser (desktop or phone), and ship daily.

---

## Why this exists

Most X tools assume you have paid API credits and a SaaS subscription. **X Tweet Helper** is different:

- **Free posting workflow** — Draft → **Open in X** → post in the app → **Log posted** on your dashboard streak.
- **Multi-provider AI** — OpenAI, Anthropic, Google Gemini, Grok (xAI), or **Antigravity** on your Mac (Google AI Pro, no API key).
- **Mobile-friendly** — Run on your Mac over Wi‑Fi; use your phone as a thin client.
- **Your data** — Postgres on your machine or your cloud; tokens encrypted at rest.

---

## Features

| Area | What you get |
|------|----------------|
| **Tweet Studio** | Hooks, threads, tone presets, refine actions (shorten, punch up, CTA, hashtags) |
| **Reply panel** | Paste a tweet URL + text → AI reply drafts → Open in X |
| **Blog Studio** | Topic → outline → section-by-section AI draft → polish |
| **Dashboard** | Posting streak, manual log for browser posts, quick idea capture |
| **Scheduling** | Queue posts (pg-boss worker) when you have X API credits |
| **Analytics** | Engagement snapshots, best-time heatmap, per-post drill-down |
| **Growth** | Follower tracking, recommendations, weekly recap |

---

## Quick start

### Prerequisites

- **Node.js 20+**
- **Docker** (for local Postgres) or Postgres 14+
- **X Developer app** — [developer.x.com](https://developer.x.com) with OAuth 2.0
- **At least one AI provider** — API key in env/Settings, *or* Antigravity IDE on Mac

### 1. Clone and install

```bash
git clone https://github.com/atulmishra1996/x-tweet-helper.git
cd x-tweet-helper
npm install
```

### 2. Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`. **Never commit this file.**

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes (prod) | Default works with Docker Compose below |
| `ENCRYPTION_KEY` | Yes (prod) | `openssl rand -hex 32` |
| `SESSION_SECRET` | Yes (prod) | `openssl rand -hex 32` |
| `X_CLIENT_ID` / `X_CLIENT_SECRET` | For X login | OAuth 2.0 app credentials |
| `X_CALLBACK_URL` | Yes | Must match developer.x.com callback |
| `OPENAI_API_KEY` etc. | One of | Or use Antigravity (see below) |
| `ANTIGRAVITY_PROXY_URL` | Optional | `http://127.0.0.1:4000` on Mac |
| `ANTIGRAVITY_PROXY_ENABLED` | Optional | `true` to prefer Antigravity over `GOOGLE_API_KEY` |

You can also add provider keys later in **Settings** (stored encrypted in the DB).

### 3. Database

```bash
docker compose up -d
npm run db:push
```

### 4. Run

```bash
npm run dev          # http://localhost:3000
npm run worker       # scheduling + metric sync (separate terminal)
```

**Mac + Antigravity (Google AI Pro, no Gemini API key):**

```bash
# Keep Antigravity IDE open with this repo as a workspace, then:
npm run dev:all      # Antigravity bridge + Next.js
```

**Phone on same Wi‑Fi:**

```bash
npm run dev:lan      # prints http://<your-mac-ip>:3000
```

See [Mobile access](#mobile-access) for OAuth callback setup.

---

## X Developer setup

1. Create an app at [developer.x.com](https://developer.x.com) with **OAuth 2.0**.
2. Callback URL: `http://localhost:3000/api/auth/x/callback` (or your LAN URL for phone).
3. Scopes: `tweet.read tweet.write users.read offline.access`.

### API credits (2026)

New X developer accounts use **pay-per-use** billing. OAuth sign-in works without credits, but **posting and lookup via API return 402** when your balance is zero.

**No credits?** Use the built-in free flow:

1. Write in Tweet Studio (AI assist works server-side).
2. Tap **Open in X** — opens the compose window in the X app/browser.
3. After posting, tap **Log posted** or use **Log N tweets** on the dashboard.

---

## AI providers

Switch provider and model from the header **Settings** page.

| Provider | Config |
|----------|--------|
| OpenAI | `OPENAI_API_KEY` |
| Anthropic | `ANTHROPIC_API_KEY` |
| Google Gemini | `GOOGLE_API_KEY` or Antigravity bridge |
| Grok (xAI) | `XAI_API_KEY` |
| **Antigravity** | `ANTIGRAVITY_PROXY_URL` + IDE open on Mac |

Antigravity runs a local OpenAI-compatible bridge (`open-antigravity` on port 4000). Tweet generation prefers **Gemini 3 Flash** for speed. Generation can take **30–90 seconds** — the UI shows a progress banner.

---

## Mobile access

Your Mac runs the app and AI; your phone is a browser on the same Wi‑Fi.

1. Run `npm run dev:lan` and note the printed IP (e.g. `192.168.1.42`).
2. In `.env.local`:
   ```
   APP_URL=http://192.168.1.42:3000
   X_CALLBACK_URL=http://192.168.1.42:3000/api/auth/x/callback
   ```
3. Add the same callback URL in the X Developer Portal.
4. Restart `dev:lan` and open the LAN URL on your phone.
5. Optional: Safari → Share → **Add to Home Screen** (PWA manifest included).

Tweet Studio on mobile uses **AI | Write | Reply** tabs so hooks and threads are easy to find.

---

## Project structure

```
app/           Next.js App Router (UI + /api routes)
components/    UI + feature modules (tweet, blog, dashboard, …)
lib/           Auth, DB, LLM factory, X client, prompts, analytics
workers/       pg-boss jobs: scheduled posts, metric sync, growth
drizzle/       SQL migrations
scripts/       dev-lan, Antigravity patch, backup
tests/         Vitest + Playwright
```

---

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Next.js dev server |
| `npm run dev:all` | Antigravity proxy + app |
| `npm run dev:lan` | Same, bound to `0.0.0.0` for phone |
| `npm run antigravity:proxy` | Antigravity bridge only (port 4000) |
| `npm run worker` | Background jobs |
| `npm run db:push` | Apply schema to Postgres |
| `npm run db:migrate` | Run migrations |
| `npm run build` / `start` | Production |
| `npm run test` | Unit/integration tests |
| `npm run test:e2e` | Playwright E2E |

---

## Deployment

1. Provision Postgres (Neon, Supabase, RDS, …) → `DATABASE_URL`.
2. Set all secrets in your host's env (never in git): `ENCRYPTION_KEY`, `SESSION_SECRET`, X OAuth, LLM keys, `CRON_SECRET`.
3. `npm run db:migrate && npm run build && npm run start`.
4. Either run `npm run worker` as a separate process **or** use Vercel cron (`vercel.json`) with `CRON_SECRET`.

For production mobile/LAN, prefer `npm run build && npm run start -- -H 0.0.0.0` over `dev:lan`.

---

## Security

- `.env.local` and `.env` are gitignored — use `.env.example` as a template only.
- X tokens and provider API keys are **AES-256-GCM encrypted** in Postgres.
- LLM and X calls are **server-side only**; keys never reach the browser.
- Sessions use signed **HttpOnly** cookies.
- Cron routes require `Authorization: Bearer <CRON_SECRET>` in production.

---

## Testing

```bash
npm run test
npx playwright install   # once
npm run test:e2e
```

---

## License

MIT — see [LICENSE](LICENSE).

---

## Contributing

Issues and PRs welcome. Please do not commit secrets, `.env.local`, or local database dumps.
