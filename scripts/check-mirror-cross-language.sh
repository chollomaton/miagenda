#!/bin/bash
set -euo pipefail
web_root="$(cd "$(dirname "$0")/.." && pwd)"
native_root="${1:?Pass the isolated native repository path}"
mirror_temp="$(mktemp -d)"
trap 'rm -rf "$mirror_temp"' EXIT
cmp "$web_root/tests/fixtures/mirror/full-snapshot.json" "$native_root/MirrorPublisher/Tests/MirrorPublisherCoreTests/Fixtures/full-snapshot.json"
cmp "$web_root/tests/fixtures/mirror/canonical-vectors.json" "$native_root/MirrorPublisher/Tests/MirrorPublisherCoreTests/Fixtures/canonical-vectors.json"
swift test --package-path "$native_root/MirrorPublisher" --filter AppleSourceTests.testSharedCanonicalVectors
swift run --package-path "$native_root/MirrorPublisher" mirror-fixture-publish "$web_root/tests/fixtures/mirror/full-snapshot.json" "$mirror_temp/swift-generation.json"
cmp "$mirror_temp/swift-generation.json" "$web_root/tests/fixtures/mirror/swift-generation.json"
cd "$web_root"
npm test -- --run tests/mirror-cross-language.test.ts tests/mirror-contract.test.ts
