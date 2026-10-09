#!/bin/bash
set -euo pipefail
mirror_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$mirror_root"
if [[ -n "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]]; then echo 'Remove real credential variables before running the synthetic emulator'; exit 2; fi
[[ -x emulator/node_modules/.bin/firebase ]] || { echo 'Run npm ci --prefix emulator first'; exit 2; }
case "${1:-}" in
 start) exec emulator/node_modules/.bin/firebase emulators:start --config emulator/firebase.json --project demo-miagenda-mirror --only firestore,auth ;;
 tests) exec emulator/node_modules/.bin/firebase emulators:exec --config emulator/firebase.json --project demo-miagenda-mirror --only firestore,auth 'bash scripts/mirror-emulator-session.sh tests' ;;
 e2e)
  mirror_native="${2:?Pass isolated native repository}"
  # No shell interpolation of the supplied repository path into the CLI command.
  export MIAGENDA_SYNTHETIC_NATIVE_PATH="$mirror_native"
  exec emulator/node_modules/.bin/firebase emulators:exec --config emulator/firebase.json --project demo-miagenda-mirror --only firestore,auth 'bash scripts/mirror-emulator-session.sh e2e "$MIAGENDA_SYNTHETIC_NATIVE_PATH"' ;;
 *) echo 'Use start, tests, or e2e native-repo-path'; exit 2 ;;
esac
