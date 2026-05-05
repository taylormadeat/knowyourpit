# knowyourpit

## Overview

knowyourpit is an AI-powered BBQ planning and management application. It offers tools for managing grill profiles, logging cook sessions, and providing AI-driven cook plans and time predictions. The app also features temperature monitoring, recipe management, and personalized pit master coaching. Its vision is to become the go-to platform for BBQ enthusiasts, enhancing their cooking experience with smart technology and community engagement.

## User Preferences

- All `eas` and `expo` commands must be run from `artifacts/knowyourpit/`, never from the workspace root.
- Do not delete the disabled Apple Watch companion app code; it is the starting point for future modernization work.

## System Architecture

The project uses a monorepo structure managed by pnpm workspaces. It is built with Node.js 24 and TypeScript 5.9.

**Core Technologies:**
- **Mobile App**: Expo / React Native
- **API Framework**: Express 5 (served at `/api`)
- **Database**: PostgreSQL with Drizzle ORM
- **Validation**: Zod
- **AI**: OpenAI via Replit AI Integrations

**UI/UX and Features:**
- **Dashboard**: Provides an overview of stats, recent cooks, and quick actions.
- **Grill Profiles**: Allows CRUD operations for managing different grills, including their history and statistics.
- **Cook Logger**: Records cook sessions with details like food type, weight, target temperatures, status, notes, and ratings.
- **AI Assistant & Predictions**: Offers natural language BBQ guidance and intelligent cook time predictions based on various parameters.
- **Temperature Monitoring**: Supports uploading data from various temperature probes (MEATER, ThermoWorks, Inkbird, Govee) and displays historical data with charts.
- **Recipes**: Enables browsing, searching, favoriting, and managing BBQ recipes.
- **Community**: Includes a forum for posts, comments, and likes, alongside categorized cooking tips.
- **Alerts**: Users can set temperature thresholds and rules for notifications.
- **Competition Mode (Pro)**: A plan type — third option in the Plan tab's three-way toggle (Single Cook / Multi-Cook / Competition). Pro-gated; selecting it opens the CompetitionSetupModal and cancelling reverts the toggle to "Single". Backwards-plans a 4-category competition (chicken, ribs, pork, brisket) to per-item turn-in times. The server deterministically recomputes `grillLightAt` / `meatOnAt` / `estimatedFinishAt` from each item's `turnInAt` and emits a per-item `warning` when a back-planned start is already in the past or unrealistically tight. The session view renders a competition badge, category chips, real-time countdowns to each turn-in (red inside the last 30 min), a 15-minute box-packing step, and a "Log Your Results" sheet for placement / judge score / notes. Competition placements feed the PitMaster Score with the highest weight (0.5). The Cook Log includes a "Competitions" filter chip. All constants use the `COMPETITION_` prefix; the old branding aliases were fully removed.
- **Frozen Meat Planning**: Cooks can be flagged frozen with a chosen thaw method (refrigerator / cold-water / microwave / counter / cook-from-frozen). The Plan tab + AI predict route factor thaw + temper time into estimates; notifications fire when thaw and temper windows complete. The frozen-from flag is persisted on the Cook record so the Cook detail view shows the original state, not just the planning input.
- **Authentication**: Clerk (`@clerk/expo`). Email + password is primary. Google SSO works in dev and (once enabled in the prod Clerk instance) in production. Apple Sign-In is shown only when `AppleAuthentication.isAvailableAsync()` returns true; on iOS the native Apple flow exchanges an identity token via Clerk's `oauth_token_apple` strategy. All auth screens (`sign-in`, `sign-up`, `set-username`) render with the dark palette unconditionally via `useAuthColors()` regardless of system theme. Sign-in / sign-up handlers map Clerk error codes to user-friendly messages.
- **Account Deletion (Apple compliance)**: Reachable from the More tab → "Delete account". `DELETE /api/profile/me` wipes the user's cooks, temperature readings, alerts, AI conversations, custom meat cuts, grills, MEATER/ThermoWorks credentials, subscription entitlements, and AI-analyze events in a single transaction, then deletes the Clerk user. If Clerk delete fails the data is still gone and the client signs the user out with a "contact support" message — no orphan-data state is possible.
- **App Store Reviewer Demo Sign-In**: `POST /api/reviewer/sign-in-token` (no auth required, rate-limited 30/hr) creates a Clerk `sign_in_token` for the hardcoded reviewer user ID and returns `{ token }`. The mobile sign-in screen (when `EXPO_PUBLIC_REVIEWER_MODE=1`) has a "Sign in as Demo User" button that calls this endpoint and uses Clerk's `strategy: "ticket"` to complete sign-in — bypasses email+password and any second-factor requirements entirely.

**Technical Implementations:**
- **API Codegen**: Utilizes Orval for generating API hooks and Zod schemas from an OpenAPI specification.
- **Build System**: esbuild for CJS bundles.
- **Database Schema**: Key tables include `grills`, `cooks`, `recipes`, `temperature_readings`, `forum_posts`, `forum_comments`, `cooking_tips`, `alerts`, and `conversations`/`messages`.
- **Environment Variables**: Managed through `DATABASE_URL`, `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`, and `SESSION_SECRET`.
- **Shared Brand Assets (lib/brand-assets)**: Canonical package holding three files: `app-icon.png` (the circular grill icon), `logo.png` (the brand logo — distinct from the icon for future design flexibility), and `wordmark.png`. The marketing site (`public/icon.png` → app-icon, `public/logo.png` → logo, `public/wordmark.png`), promo-video (`public/brand/app-icon.png`, `app-logo.png` → logo, `marketing-logo.png` → logo, `wordmark.png`), and mobile app (`assets/images/icon.png` → app-icon, `assets/images/logo.png` → logo) all point to these files via relative symlinks — updating a file in one place propagates everywhere.
- **Marketing Website (artifacts/marketing)**: A React + Vite application serving the landing page, privacy policy, terms of service, and support pages. It includes a contact form backend integrated with the API server.
- **Production Routing**: The deployed project hosts both the API server and the marketing static site. `/api/*` and `/health` are handled by the API server, while all other paths are served by the marketing site. Custom domain setup involves specific DNS records for `knowyourpit.com` and `www.knowyourpit.com`.

## External Dependencies

- **OpenAI**: Integrated for AI assistant and prediction functionalities through Replit AI Integrations (gpt-5.2).
- **PostgreSQL**: Used as the primary database, managed with Drizzle ORM.
- **Expo/React Native**: Framework for mobile application development.
- **MEATER, ThermoWorks, Inkbird, Govee**: External temperature probe brands supported for data upload.
- **Apple Push Notification Service (APNS)**: Implicitly used for mobile alerts and notifications via Expo.
- **Clerk**: Potentially used for authentication, though the contact form is not behind Clerk auth.
- **express-rate-limit**: Middleware used on the API server for rate limiting, specifically on the contact form endpoint.
- **Let's Encrypt**: Used for automatic TLS certificate provisioning for custom domains.
- **RevenueCat**: Subscription paywall — `pro` entitlement (monthly + annual). Mobile uses `react-native-purchases`; admin scripts in `scripts/src/{seedRevenueCatProducts,grantPro,revokePro}.ts` use `@replit/revenuecat-sdk` via the Replit RevenueCat connector. Server-side gates live in `artifacts/api-server/src/lib/paywall.ts` and emit a uniform 402 response via `respondPaywall(res, ...)`. Set `PAYWALL_ENABLED=false` to bypass every gate globally.