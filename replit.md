# KnowYourPit

## Overview

KnowYourPit is a comprehensive BBQ planning and management app powered by AI. Users can manage grill profiles, log cook sessions, get AI-powered cook plans and time predictions, monitor temperatures, browse recipes, and get personalized pit master coaching.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Mobile app**: Expo / React Native (artifacts/knowyourpit)
- **API framework**: Express 5 (artifacts/api-server), served at `/api`
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI**: OpenAI via Replit AI Integrations (gpt-5.2)

## Features

- **Dashboard**: Overview stats, recent cooks, quick actions
- **Grill Profiles**: CRUD for multiple grill profiles with cook history and stats
- **Cook Logger**: Log cook sessions with food type, weight, target temps, status, notes, ratings
- **AI Assistant**: Natural language BBQ guidance using OpenAI
- **AI Predictions**: Smart cook time predictions based on food type, weight, grill, and history
- **Temperature Upload**: Upload data from MEATER, ThermoWorks, Inkbird, Govee, or CSV
- **Temperature Monitoring**: Historical temperature readings with charts per cook
- **Recipes**: Browse, search, favorite, and manage BBQ recipes
- **Community Forum**: Post, comment, and like in category-based forum
- **Cooking Tips**: Browse tips by category and difficulty
- **Alerts**: Set temperature thresholds and alert rules

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Database Tables

- `grills` — Grill profiles
- `cooks` — Cook sessions
- `recipes` — BBQ recipes
- `temperature_readings` — Temperature probe readings
- `forum_posts` — Community forum posts
- `forum_comments` — Forum post comments
- `cooking_tips` — Curated cooking tips
- `alerts` — Temperature alert rules
- `conversations` / `messages` — AI conversation history (via OpenAI integration)

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` — OpenAI proxy URL (auto-provisioned via Replit AI Integrations)
- `AI_INTEGRATIONS_OPENAI_API_KEY` — OpenAI API key (auto-provisioned)
- `SESSION_SECRET` — Session secret

## Deploying the API Server

The API server (`artifacts/api-server`) must be published via Replit's Publish feature before running a production EAS build of the mobile app.

### Steps to deploy

1. Click the **Publish** button in the Replit header (or re-publish if already deployed).
2. After publishing, your deployed URL appears in the Replit header — it follows the pattern:
   `https://<your-replit-app>.replit.app`
3. Verify the health check returns 200 from the deployed URL:
   `GET https://<your-replit-app>.replit.app/health` → `{"status":"ok"}`

The API server is currently deployed and serving traffic (confirmed via deployment logs:
`GET /api/healthz` returns 200, DB-backed routes return correct responses).

### Setting EXPO_PUBLIC_API_URL for EAS builds

`artifacts/knowyourpit/eas.json` has `EXPO_PUBLIC_API_URL` set in `build.production.env` to the confirmed live deployed URL:

```
https://6583df0b-1166-4042-a222-d49fbda4017d-00-lgd8ruzq76oq-ufrk6h68.janeway.replit.dev
```

If the project is later re-deployed under a new `.replit.app` custom domain, update this value in `eas.json` and in the comment at the top of `artifacts/knowyourpit/app/_layout.tsx`.

Alternatively, pass it as an EAS secret instead of hardcoding in eas.json:
```
eas secret:create EXPO_PUBLIC_API_URL <deployed-url>
```

The mobile app prepends this base URL to all API calls (e.g., `/api/grills`, `/api/cooks`).

### Health check endpoints

- `GET /health` — top-level health check (used by Replit deployment)
- `GET /api/healthz` — API-prefixed health check

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
