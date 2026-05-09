#!/bin/bash
set -e
pnpm install --no-frozen-lockfile
ALLOW_ORPHAN_DROP=true pnpm --filter @workspace/db run drop-orphans
pnpm --filter @workspace/db run push-force
