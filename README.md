# Tablekeep

A D&D campaign companion that keeps the whole table in sync: shared live dice, a real-time initiative tracker, and session notes that turn into AI-written "previously on…" recaps.

**Tech stack:** Next.js 15 (App Router, Server Actions, Route Handlers), TypeScript, Tailwind CSS, Supabase (Postgres, Auth, Realtime, row level security), Gemini API (streaming), Vitest, GitHub Actions

## Features

- **Campaigns and invites:** create a campaign as the DM and share a six-character invite code. Players join with their character name.
- **Live dice:** quick d4–d100 buttons, advantage and disadvantage, and full notation (`2d6+3`, `4d6kh3`, `1d8+1d6-1`). Rolls happen on the server with cryptographic randomness and appear for everyone instantly. Natural 20s and 1s are highlighted.
- **Initiative tracker:** turn order, rounds, HP with damage and healing, and bloodied and down states, synced in real time for every player.
- **Presence:** see who's at the table right now.
- **Session notes and AI recaps:** notes autosave as you type, and one click streams a recap written by Gemini from your notes.

## How it's built

- **Security:** every table uses Postgres row level security, so players only ever see campaigns they belong to, and can only post rolls as themselves. The policies are covered by integration tests that run against a real Supabase stack (`tests/rls.integration.test.ts`).
- **Real time:** Supabase Realtime `postgres_changes` subscriptions for rolls, combatants, turn state and members, plus Presence for who's online.
- **Pure, tested logic:** the dice parser and roller (`src/lib/dice.ts`) and initiative rules (`src/lib/initiative.ts`) are framework-free and unit tested.
- **AI recaps:** a Route Handler streams Gemini's output to the browser as it's written, then saves the recap. It handles blocked responses, rate limits and missing keys gracefully.
- **CI:** GitHub Actions runs lint, type checking, unit tests and a production build, then starts Supabase and runs the security tests.

## Running locally

You need Node 22+, Docker and the [Supabase CLI](https://supabase.com/docs/guides/local-development).

```bash
npm install
supabase start          # starts Postgres, Auth and Realtime locally and applies the migration
cp .env.example .env.local
```

Put the `PUBLISHABLE_KEY` printed by `supabase status` into `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and optionally a free Gemini API key from Google AI Studio into `GEMINI_API_KEY` to enable recaps. Then:

```bash
npm run dev
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the app on http://localhost:3000 |
| `npm test` | Unit tests (dice, initiative, recap prompt) |
| `npm run test:integration` | Row level security tests against local Supabase (set `SUPABASE_PUBLISHABLE_KEY`) |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm run build` | Production build |

## Deploying

1. Create a Supabase project and run `supabase link` then `supabase db push` to apply the migration.
2. Import the repo on Vercel and set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `GEMINI_API_KEY`.
3. In Supabase Auth settings, add your Vercel URL as the site URL.

Built by [Rahul JS (Rae)](https://rahuljs.vercel.app).
