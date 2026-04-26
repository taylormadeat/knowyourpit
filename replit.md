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

**Technical Implementations:**
- **API Codegen**: Utilizes Orval for generating API hooks and Zod schemas from an OpenAPI specification.
- **Build System**: esbuild for CJS bundles.
- **Database Schema**: Key tables include `grills`, `cooks`, `recipes`, `temperature_readings`, `forum_posts`, `forum_comments`, `cooking_tips`, `alerts`, and `conversations`/`messages`.
- **Environment Variables**: Managed through `DATABASE_URL`, `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`, and `SESSION_SECRET`.
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