#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
[[ -z "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]] || { echo 'Real credentials forbidden'; exit 2; }
export MIAGENDA_PREPROD=1
export MIAGENDA_PREPROD_NATIVE="${1:?Pass isolated native repository}"
[[ "$(git -C "$MIAGENDA_PREPROD_NATIVE" branch --show-current)" == feature/1.2-icloud-readonly-mirror ]] || exit 2
swift build --package-path "$MIAGENDA_PREPROD_NATIVE/MirrorPublisher"
exec emulator/node_modules/.bin/firebase emulators:exec --config preprod/firebase.json --project demo-miagenda-mirror --only firestore,auth 'bash preprod/session.sh'
