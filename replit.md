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

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
