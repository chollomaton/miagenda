#!/bin/bash
set -euo pipefail
npm run dev -- --host 127.0.0.1 --port 15173 --strictPort > work/preprod-vite.log 2>&1 &
mirror_vite_pid=$!
trap 'kill "$mirror_vite_pid" 2>/dev/null || true' EXIT INT TERM
for attempt in {1..60}; do
 if curl -s --max-time 1 http://127.0.0.1:15173/miagenda/ >/dev/null; then break; fi
 sleep 0.25
done
for repeat in 1 2 3 4 5; do
 node --test preprod/rules.test.mjs
 node preprod/e2e.mjs "$MIAGENDA_PREPROD_NATIVE"
done
