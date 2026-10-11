#!/bin/bash
set -euo pipefail
mirror_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$mirror_root"
export MIAGENDA_EMULATOR=1
export FIRESTORE_EMULATOR_HOST=127.0.0.1:18080
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:19099
unset GOOGLE_APPLICATION_CREDENTIALS
if [[ "${1:-}" == tests ]]; then
 node --test emulator/rules.test.mjs
 emulator/node_modules/.bin/tsx --test emulator/authority.test.ts
 ./node_modules/.bin/tsc -p emulator/tsconfig.json
 exit
fi
[[ "${1:-}" == e2e || "${1:-}" == real-e2e ]] || { echo 'Use tests or e2e native-repo-path'; exit 2; }
mirror_native="${2:?Pass isolated native repository}"
[[ "$(git -C "$mirror_native" branch --show-current)" == feature/1.2-icloud-readonly-mirror ]] || exit 2
swift build --package-path "$mirror_native/MirrorPublisher"
emulator/node_modules/.bin/tsx emulator/server.ts &
mirror_authority_pid=$!
npm run dev -- --host 127.0.0.1 --port 15173 --strictPort &
mirror_vite_pid=$!
trap 'kill "$mirror_authority_pid" "$mirror_vite_pid" 2>/dev/null || true' EXIT INT TERM
for mirror_attempt in {1..60}; do
 if curl -s --max-time 1 http://127.0.0.1:18081/ >/dev/null && curl -s --max-time 1 http://127.0.0.1:15173/miagenda/ >/dev/null; then break; fi
 sleep 0.25
done
if [[ "${1:-}" == real-e2e ]]; then
 for mirror_repeat in 1 2 3; do
  node emulator/tests/real-input.mjs "$mirror_native" "$MIAGENDA_LOCAL_REAL_INPUT" "${MIAGENDA_LOCAL_REAL_REPORT%.json}-$mirror_repeat.json"
 done
else
 node emulator/tests/e2e.mjs "$mirror_native"
 node emulator/tests/e2e.mjs "$mirror_native"
fi
